
local M = {}

-- Перевод секунд в миллисекунды
local function toMs(value)
    if value == nil then return nil end
    return value * 1000
end

local function getReloadTimingFromParam(param)
    local reload_feed = {param.reload_feed, param.reload_xmag_1_feed, param.reload_xmag_2_feed, param.reload_xmag_3_feed}
    local reload_cooldown = {param.reload_cooldown, param.reload_xmag_1_cooldown, param.reload_xmag_2_cooldown, param.reload_xmag_3_cooldown}
    local empty_feed = {param.empty_feed, param.empty_xmag_1_feed, param.empty_xmag_2_feed, param.empty_xmag_3_feed}
    local empty_cooldown = {param.empty_cooldown, param.empty_xmag_1_cooldown, param.empty_xmag_2_cooldown, param.empty_xmag_3_cooldown}
    
    -- Новые параметры для клина оружия
    local jam_chance = {param.jam_chance, param.jam_xmag_1_chance, param.jam_xmag_2_chance, param.jam_xmag_3_chance}
    local jam_cooldown = {param.jam_cooldown, param.jam_xmag_1_cooldown, param.jam_xmag_2_cooldown, param.jam_xmag_3_cooldown}

    if not (param.reload_feed and param.reload_cooldown and param.empty_feed and param.empty_cooldown) then
        return nil, nil, nil, nil, nil, nil
    end

    -- Сохраняем базовые значения клина ДО цикла, чтобы использовать их для всех индексов
    local base_jam_chance = 0
    --local base_jam_chance = jam_chance[1] or 0.05
    local base_jam_cooldown = jam_cooldown[1] or 2.0

    for i = 1, 4 do
        reload_feed[i] = (reload_feed[i] or reload_feed[1]) * 1000
        reload_cooldown[i] = (reload_cooldown[i] or reload_cooldown[1]) * 1000
        empty_feed[i] = (empty_feed[i] or empty_feed[1]) * 1000
        empty_cooldown[i] = (empty_cooldown[i] or empty_cooldown[1]) * 1000
        
        -- Игнорируем jam_chance[i]/jam_cooldown[i] и всегда пишем базовое значение
        jam_chance[i] = base_jam_chance
        jam_cooldown[i] = base_jam_cooldown * 1000
    end

    return reload_feed, reload_cooldown, empty_feed, empty_cooldown, jam_chance, jam_cooldown
end

local function isReloadingEmpty(stateType)
    return stateType == EMPTY_RELOAD_FEEDING or stateType == EMPTY_RELOAD_FINISHING
end

local function isReloadingTactical(stateType)
    return stateType == TACTICAL_RELOAD_FEEDING or stateType == TACTICAL_RELOAD_FINISHING
end

local function isReloading(stateType)
    return isReloadingEmpty(stateType) or isReloadingTactical(stateType)
end

local function isReloadFinishing(stateType)
    return stateType == EMPTY_RELOAD_FINISHING or stateType == TACTICAL_RELOAD_FINISHING
end

-- Вспомогательная функция для проверки, является ли оружие подствольником
local function isUglGun(gunId)
    if not gunId then return false end
    local suffixes = {"_gp25", "_m203", "_m26", "_m870", "_gp46"}
    for _, suffix in ipairs(suffixes) do
        if string.sub(gunId, -#suffix) == suffix then
            return true, suffix
        end
    end
    return false, nil
end

local function finishReload(api, is_tactical)
    local nbt = api:getNbt()
    if nbt == nil then return end

    -- ПРОВЕРКА: Если оружие было в состоянии перегрева (клина)
    if api:isOverheatLocked() then
        api:setOverheatLocked(false) -- Снимаем встроенный клин
        
        local entity = api:getEntityUtil()
        	
        local firemod = nbt:getInt("SavedFireMode")
        local vernut = nbt:getInt("AmmoBefore") 
		
        nbt:putInt("GunCurrentAmmoCount", vernut)
        nbt:putString("HasBulletInBarrel", 1)
        api:setAmmoInBarrel(0)
		
        if firemod == 0 then
            nbt:putString("GunFireMode", "AUTO")
        elseif firemod == 1 then	
            nbt:putString("GunFireMode", "SEMI")
        else 
            nbt:putString("GunFireMode", "BURST")
        end
        return 
    end

    local extMag = api:getAttachment("EXTENDED_MAG")
    local isFlipMag = (extMag == "ra1k:flip_mag")

    -- МЕХАНИКА СПАРЕННЫХ МАГАЗИНОВ (FLIP-MAG)
    if isFlipMag and is_tactical then
        local currentAmmo = api:getAmmoCountInMagazine()
        local backupAmmo = 0
        if nbt:contains("FlipMagAmmo") then
            backupAmmo = nbt:getInt("FlipMagAmmo")
        end

        api:removeAmmoFromMagazine(currentAmmo)
        api:putAmmoInMagazine(backupAmmo)
        nbt:putInt("FlipMagAmmo", currentAmmo)     
        return
    end

    -- СТАНДАРТНАЯ ЛОГИКА ПОПОЛНЕНИЯ ОСНОВНОГО МАГАЗИНА
    local needAmmoCount = api:getNeededAmmoAmount()
    if (api:isReloadingNeedConsumeAmmo()) then
        api:putAmmoInMagazine(api:consumeAmmoFromPlayer(needAmmoCount))
    else
        api:putAmmoInMagazine(needAmmoCount)
    end

    -- ДОПОЛНЕНИЕ ДЛЯ FLIP-MAG
    if isFlipMag and not is_tactical then
        local maxAmmo = api:getMaxAmmoCount()
        
        if api:isReloadingNeedConsumeAmmo() then
            local consumed = api:consumeAmmoFromPlayer(maxAmmo)
            nbt:putInt("FlipMagAmmo", consumed)
        else
            nbt:putInt("FlipMagAmmo", maxAmmo)
        end
    end

    local currentGunId = nbt:getString("GunId") or ""
    local isUgl = isUglGun(currentGunId)

    if not is_tactical and not isUgl then
        local i = api:removeAmmoFromMagazine(1)
        if i ~= 0 then
            api:setAmmoInBarrel(0)
        end
    end
end

-- ==========================================
-- НАСТРОЙКА РАНДОМНОГО КЛИНА ЧЕРЕЗ OVERHEAT
-- ==========================================

function M.tick_heat(api, heatTimestamp)
    local nbt = api:getNbt()
    if nbt == nil then return end

    local currentGunId = nbt:getString("GunId")
    if currentGunId == nil or currentGunId == "" then return true end
	
    local attachment = api:getAttachment("GRIP")
    local muzzle = api:getAttachment("MUZZLE")
	
    if currentGunId == "ra1k:ak224" or currentGunId == "ra1k:ak50_lite" then
        if muzzle ~= "ra1k:kit_lmg" then
            if nbt:contains("GunFireMode") and nbt:getString("GunFireMode") ~= "SEMI" then
                nbt:putString("GunFireMode", "SEMI")				
            end
        end
    end
		
    -- Список поддерживаемых подствольников и их идентификаторов
    local uglAttachments = {
        ["ra1k:gp25"] = "_gp25",
        ["ra1k:m203"] = "_m203",
        ["ra1k:m26"]  = "_m26",
        ["ra1k:m870"] = "_m870",
        ["ra1k:gp46"] = "_gp46"
    }

    if (api:getFireMode() == SEMI) then
        local targetSuffix = uglAttachments[attachment]
        
        -- Установка подствольника при его наличии
        if targetSuffix then
            if string.sub(currentGunId, -#targetSuffix) ~= targetSuffix then
                local targetGunId = currentGunId .. targetSuffix
                local bulletsInMag = api:getAmmoCountInMagazine()
                nbt:putInt("SavedBulletCount", bulletsInMag)
                nbt:putInt("NeedRestoreAmmo", 0)
                if bulletsInMag > 0 then api:removeAmmoFromMagazine(bulletsInMag) end
                nbt:putString("GunId", targetGunId)              
                
                if nbt:contains("SavedUglAmmo") then
                    local savedUgl = nbt:getInt("SavedUglAmmo")
                    if savedUgl > 1 then savedUgl = 1 end
                    if savedUgl > 0 then 
                        api:putAmmoInMagazine(savedUgl) 
                    else
                        if api:getAmmoCountInMagazine() > 0 then
                            api:removeAmmoFromMagazine(api:getAmmoCountInMagazine())
                        end
                    end
                    nbt:putInt("SavedUglAmmo", 0)
                else
                    api:removeAmmoFromMagazine(1)
                end
                return true
            end
        end
    
        -- Снятие подствольника
        if attachment == "tacz:empty" or attachment == nil or attachment == "" then
            local isUgl, suffix = isUglGun(currentGunId)
            if isUgl then
                local targetGunId = string.sub(currentGunId, 1, -(#suffix + 1))
                local currentUglAmmo = api:getAmmoCountInMagazine()
                nbt:putInt("SavedUglAmmo", currentUglAmmo)
                if currentUglAmmo > 0 then api:removeAmmoFromMagazine(api:getAmmoCountInMagazine()) end
                nbt:putString("GunId", targetGunId)
                if api:hasAmmoInBarrel() == 1 then
                    nbt:putString("HasBulletInBarrel", 0)
                    api:setAmmoInBarrel(0)
                end									 
                nbt:putInt("NeedRestoreAmmo", 1)
                nbt:putString("GunFireMode", "AUTO")
                return true
            end
            if nbt ~= nil and not uglAttachments[attachment] then
                if nbt:getInt("NeedRestoreAmmo") == 1 then
                    if nbt:contains("SavedBulletCount") then
                        local savedBullets = nbt:getInt("SavedBulletCount")
                        if savedBullets > 0 then api:putAmmoInMagazine(savedBullets) end
                    end
                    nbt:putInt("NeedRestoreAmmo", 0)
                end
            end
        end
    elseif (api:getFireMode() == AUTO) then
        local isUgl, suffix = isUglGun(currentGunId)
        if isUgl then
            local targetGunId = string.sub(currentGunId, 1, -(#suffix + 1))
            local currentUglAmmo = api:getAmmoCountInMagazine()
            nbt:putInt("SavedUglAmmo", currentUglAmmo)
            if currentUglAmmo > 0 then api:removeAmmoFromMagazine(api:getAmmoCountInMagazine()) end
            nbt:putString("GunId", targetGunId)
            if api:hasAmmoInBarrel() == 1 then
                nbt:putString("HasBulletInBarrel", 0)
                api:setAmmoInBarrel(0)
            end	
            nbt:putInt("NeedRestoreAmmo", 1)
            return true
        end
        if nbt:getInt("NeedRestoreAmmo") == 1 then
            if nbt:contains("SavedBulletCount") then
                local savedBullets = nbt:getInt("SavedBulletCount")
                if savedBullets > 0 then api:putAmmoInMagazine(savedBullets) end
            end
            nbt:putInt("NeedRestoreAmmo", 0)
        end
    end 
    
    if nbt:contains("AttachmentSCOPE") then
        local scopeCompound = nbt:getCompound("AttachmentSCOPE")
        if scopeCompound:contains("tag") then
            local tagCompound = scopeCompound:getCompound("tag")
            local currentScopeId = tagCompound:getString("AttachmentId")
            local zoom = nil
            if tagCompound:contains("ZoomNumber") then
                zoom = tagCompound:getInt("ZoomNumber") 
                if not zoom or zoom == 0 then zoom = tagCompound:getFloat("ZoomNumber") end
                if not zoom or zoom == 0 then zoom = tonumber(tagCompound:getString("ZoomNumber")) end
            end
            if zoom then zoom = math.floor(zoom + 0.5) end
            local aimingProgress = api:getAimingProgress() or 0
            if aimingProgress > 0.9 and zoom and zoom > 0 and (currentScopeId == "asos:sight_eotech_hhs8" or currentScopeId == "asos:sight_eotech_hhs8_nozoom") then 
                if zoom % 2 == 0 then
                    tagCompound:putString("AttachmentId", "asos:sight_eotech_hhs8")
                else
                    tagCompound:putString("AttachmentId", "asos:sight_eotech_hhs8_nozoom")
                end           
            end
			
            if aimingProgress > 0.9 and zoom and zoom > 0 and (currentScopeId == "asos:sight_eotech_hhs1" or currentScopeId == "asos:sight_eotech_hhs1_nozoom") then 
                if zoom % 2 == 0 then
                    tagCompound:putString("AttachmentId", "asos:sight_eotech_hhs1")
                else
                    tagCompound:putString("AttachmentId", "asos:sight_eotech_hhs1_nozoom")
                end           
            end
			
            if aimingProgress > 0.9 and zoom and zoom > 0 and (currentScopeId == "ra1k:sight_magnifier" or currentScopeId == "ra1k:sight_magnifier_off") then 
                if zoom % 2 == 0 then
                    tagCompound:putString("AttachmentId", "ra1k:sight_magnifier")
                else
                    tagCompound:putString("AttachmentId", "ra1k:sight_magnifier_off")
                end           
            end
			
            if aimingProgress > 0.9 and zoom and zoom > 0 and (currentScopeId == "ra1k:vudu_2x" or currentScopeId == "ra1k:vudu_6x") then 
                if zoom % 2 == 0 then
                    tagCompound:putString("AttachmentId", "ra1k:vudu_6x")
                else
                    tagCompound:putString("AttachmentId", "ra1k:vudu_2x")
                end           
            end
			
            if aimingProgress > 0.9 and zoom and zoom > 0 and (currentScopeId == "mk16:553_g43f" or currentScopeId == "mk16:553_g43") then 
                if zoom % 2 == 0 then
                    tagCompound:putString("AttachmentId", "mk16:553_g43")
                else
                    tagCompound:putString("AttachmentId", "mk16:553_g43f")
                end           
            end
            if aimingProgress > 0.9 and zoom and zoom > 0 and (currentScopeId == "asos:sight_eotech_hhs6_hdl" or currentScopeId == "asos:sight_eotech_hhs6_hdl_nozoom") then 
                if zoom % 2 == 0 then
                    tagCompound:putString("AttachmentId", "asos:sight_eotech_hhs6_hdl")
                else
                    tagCompound:putString("AttachmentId", "asos:sight_eotech_hhs6_hdl_nozoom")
                end           
            end
        end
    end

    if api:isOverheatLocked() then
        nbt:putString("GunFireMode", "UNKNOWN")		
    end
end

function M.handle_shoot_heat(api)
    -- Не используем движковое накопление тепла
end

function M.shoot(api)
    local nbt = api:getNbt()
    if nbt == nil then return end
    
    if api:isOverheatLocked() then
        local entity = api:getEntityUtil()
        nbt:putString("GunFireMode", "UNKNOWN")	
        return
    end

    -- Совершаем стандартный выстрел
    api:shootOnce(api:isShootingNeedConsumeAmmo())

    local ammoLeft = api:getAmmoCountInMagazine()
    if ammoLeft <= 0 then
        return
    end

    local param = api:getScriptParams()
    local _, _, _, _, jam_chance, _ = getReloadTimingFromParam(param)
    
    local mag_level = math.min(api:getMagExtentLevel(), 3) + 1
    local current_jam_chance = (jam_chance and jam_chance[mag_level]) or 0.02

    if math.random() < current_jam_chance then
        api:setOverheatLocked(true)
        
        local entity = api:getEntityUtil()
        if entity then
            local currentMode = api:getFireMode()
            nbt:putInt("SavedFireMode", currentMode)
            nbt:putInt("AmmoBefore", ammoLeft)
            nbt:putString("HasBulletInBarrel", 0)
            nbt:putString("GunCurrentAmmoCount", 0)
        end		
    end
end

function M.start_reload(api)
    return true
end

function M.tick_reload(api)
    local param = api:getScriptParams();
    local reload_feed, reload_cooldown, empty_feed, empty_cooldown, jam_chance, jam_cooldown = getReloadTimingFromParam(param)
    if (reload_feed == nil or reload_cooldown == nil or empty_feed == nil or empty_cooldown == nil) then
        return NOT_RELOADING, -1
    end

    local mag_level = math.min(api:getMagExtentLevel(), 3) + 1
    local countDown = -1
    local stateType = NOT_RELOADING
    local oldStateType = api:getReloadStateType()
    local progressTime = api:getReloadTime()

    if api:isOverheatLocked() then
        local current_jam_cooldown = jam_cooldown[mag_level]
        
        if isReloadingEmpty(oldStateType) then
            if progressTime < current_jam_cooldown then
                stateType = EMPTY_RELOAD_FEEDING
                countDown = current_jam_cooldown - progressTime
            else
                stateType = NOT_RELOADING
                countDown = -1
            end
        elseif isReloadingTactical(oldStateType) then
            if progressTime < current_jam_cooldown then
                stateType = TACTICAL_RELOAD_FEEDING
                countDown = current_jam_cooldown - progressTime
            else
                stateType = NOT_RELOADING
                countDown = -1
            end
        end
    else
        if isReloadingEmpty(oldStateType) then
            local feed_time = empty_feed[mag_level]
            local finishing_time = empty_cooldown[mag_level]
            if progressTime < feed_time then
                stateType = EMPTY_RELOAD_FEEDING
                countDown = feed_time - progressTime
            elseif progressTime < finishing_time then
                stateType = EMPTY_RELOAD_FINISHING
                countDown = finishing_time - progressTime
            else
                stateType = NOT_RELOADING;
                countDown = -1
            end
        elseif isReloadingTactical(oldStateType) then
            local feed_time = reload_feed[mag_level]
            local finishing_time = reload_cooldown[mag_level]
            if progressTime < feed_time then
                stateType = TACTICAL_RELOAD_FEEDING
                countDown = feed_time - progressTime
            elseif progressTime < finishing_time then
                stateType = TACTICAL_RELOAD_FINISHING
                countDown = finishing_time - progressTime
            else
                stateType = NOT_RELOADING;
                countDown = -1
            end
        else
            stateType = NOT_RELOADING;
            countDown = -1
        end
    end

    if oldStateType == EMPTY_RELOAD_FEEDING and oldStateType ~= stateType then
        finishReload(api, false);
    end

    if oldStateType == TACTICAL_RELOAD_FEEDING and oldStateType ~= stateType then
        finishReload(api, true);
    end

    return stateType, countDown
end

return M