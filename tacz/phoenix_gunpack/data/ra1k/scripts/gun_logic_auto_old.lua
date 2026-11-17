local M = {}

-- Перевод секунд в миллисекунды
local function toMs(value)
    if value == nil then return nil end
    return value * 1000
end

function M.shoot(api)
	api:shootOnce(api:isShootingNeedConsumeAmmo())
    local nbt = api:getNbt()
    if nbt == nil then return end

    -- Проверяем, какой модуль установлен в слот дульного тормоза/глушителя
    local muzzle = api:getAttachment("MUZZLE")

    -- Если модуля автоматического огня НЕТ, принудительно переключаем режим на SEMI
    if muzzle ~= "ra1k:full_auto" then
        -- Проверяем текущий режим, чтобы не перезаписывать NBT каждый выстрел впустую
        if nbt:contains("GunFireMode") and nbt:getString("GunFireMode") ~= "SEMI" then
            nbt:putString("GunFireMode", "SEMI")
            
            -- Опционально: можно вывести сообщение игроку на панель (Action Bar)
            local entity = api:getEntityUtil()
            if entity ~= nil then
                entity:sendActionBar(entity:translatable("message.ra1k.no_full_auto_module"))
            end
        end
    end
end

local function getReloadTimingFromParam(param)
    local reload_feed = {param.reload_feed, param.reload_xmag_1_feed, param.reload_xmag_2_feed, param.reload_xmag_3_feed}
    local reload_cooldown = {param.reload_cooldown, param.reload_xmag_1_cooldown, param.reload_xmag_2_cooldown, param.reload_xmag_3_cooldown}
    local empty_feed = {param.empty_feed, param.empty_xmag_1_feed, param.empty_xmag_2_feed, param.empty_xmag_3_feed}
    local empty_cooldown = {param.empty_cooldown, param.empty_xmag_1_cooldown, param.empty_xmag_2_cooldown, param.empty_xmag_3_cooldown}
    
    for i = 1, 4 do
        if (reload_feed[i] == nil or reload_cooldown[i] == nil or empty_feed[i] == nil or empty_cooldown[i] == nil) then
            return nil, nil, nil, nil
        end
        reload_feed[i] = reload_feed[i] * 1000
        reload_cooldown[i] = reload_cooldown[i] * 1000
        empty_feed[i] = empty_feed[i] * 1000
        empty_cooldown[i] = empty_cooldown[i] * 1000
    end
    return reload_feed, reload_cooldown, empty_feed, empty_cooldown
end

local function isReloadingEmpty(stateType)
    return stateType == 1 or stateType == 2
end

local function isReloadingTactical(stateType)
    return stateType == 3 or stateType == 4
end

-- Динамический расчет емкости одного рожка автомата
local function getSingleMagMax(api)
    local totalMaxJson = api:getNeededAmmoAmount() + api:getAmmoCountInMagazine()
    local half = math.floor(totalMaxJson / 2)
    if half == 31 then half = 30 end -- Костыль-предохранитель под АК
    return half
end

-----------------------------------------------------------------
-- ШТАТНАЯ ФУНКЦИЯ ЗАВЕРШЕНИЯ ПЕРЕЗАРЯДКИ
-----------------------------------------------------------------
local function finishReload(api, is_tactical)
    local nbt = api:getNbt()
    local attachment = api:getAttachment("GRIP")
    
    -- ЛОГИКА ДЛЯ ПОДСТВОЛЬНИКА
    if attachment == "ra1k:gp25" or attachment == "ra1k:m203" then
        api:removeAmmoFromMagazine(api:getAmmoCountInMagazine())
        api:setAmmoInBarrel(0)
        
        local targetUglAmmo = 1
        if api:isReloadingNeedConsumeAmmo() then
            api:putAmmoInMagazine(api:consumeAmmoFromPlayer(targetUglAmmo))
        else
            api:putAmmoInMagazine(targetUglAmmo)
        end
        
       
        return
    end

    -- ЛОГИКА ДЛЯ ОБЫЧНОГО АВТОМАТА (Обычный магазин или Спарка)
    local mag_level = math.min(api:getMagExtentLevel(), 3) + 1
    local halfMax = getSingleMagMax(api)

  --  if mag_level == 3 and nbt ~= nil then
      --  if is_tactical then
        --    local currentMain = api:getAmmoCountInMagazine()
         --   local currentTape = nbt:contains("TapeMagAmmo") and nbt:getInt("TapeMagAmmo") or halfMax
            
        --    if currentMain >= (halfMax - 1) then currentMain = halfMax end
            
         --   nbt:putInt("TapeMagAmmo", currentMain)
         --   api:removeAmmoFromMagazine(api:getAmmoCountInMagazine())
            
         --   local targetAmmo = currentTape
        --    if targetAmmo >= halfMax then targetAmmo = halfMax - 1 end
         --   if targetAmmo > 0 then api:putAmmoInMagazine(targetAmmo) end
            
         --   local entity = api:getEntityUtil()
            
    --    else
        --    api:removeAmmoFromMagazine(api:getAmmoCountInMagazine())
         --   local targetMain = halfMax - 1
         --   if api:isReloadingNeedConsumeAmmo() then
         --       api:putAmmoInMagazine(api:consumeAmmoFromPlayer(targetMain))
         --   else
         --       api:putAmmoInMagazine(targetMain)
         --   end
            
         --   nbt:putInt("TapeMagAmmo", halfMax)
            
          
        --    return
      --  end
  --  end

    -- Стандартный одиночный магазин автомата
    local needAmmoCount = api:getNeededAmmoAmount()
    
    -- ИЗМЕНЕНИЕ: Если нужно больше 1 патрона, искусственно уменьшаем на 1.
    -- Это оставляет 1 свободное место для перманентной доступности перезарядки.
    if needAmmoCount > 0 then
        needAmmoCount = needAmmoCount - 1
    end

    if (api:isReloadingNeedConsumeAmmo()) then
        api:putAmmoInMagazine(api:consumeAmmoFromPlayer(needAmmoCount))
    else
        api:putAmmoInMagazine(needAmmoCount)
    end
        
    if not is_tactical then
        local i = api:removeAmmoFromMagazine(1)
        if i ~= 0 then api:setAmmoInBarrel(1) end
    end

    -- Старый костыль удаления патрона здесь больше не нужен, 
    -- так как мы изначально не дали магазину заполниться до конца.
end

-----------------------------------------------------------------
-- ХУК НАЧАЛА ПЕРЕЗАРЯДКИ
-----------------------------------------------------------------
function M.start_reload(api)
    local nbt = api:getNbt()
    if nbt == nil then return true end

    local currentGunId = nbt:getString("GunId")
    if currentGunId == nil or currentGunId == "" then return true end
    
    local attachment = api:getAttachment("GRIP")
    local mag_level = math.min(api:getMagExtentLevel(), 3) + 1
    local halfMax = getSingleMagMax(api)

  --  if mag_level == 3 and not nbt:contains("TapeMagAmmo") then
  --      nbt:putInt("TapeMagAmmo", halfMax)
 --   end

    -- ВХОД В РЕЖИМ ПОДСТВОЛЬНИКА (ГП-25)
    if attachment == "ra1k:gp25" then
        if string.sub(currentGunId, -5) ~= "_gp25" then
            local targetGunId = currentGunId .. "_gp25"
            local bulletsInMag = api:getAmmoCountInMagazine()
            
            nbt:putInt("SavedBulletCount", bulletsInMag)
            nbt:putInt("NeedRestoreAmmo", 0)

            if bulletsInMag > 0 then api:removeAmmoFromMagazine(bulletsInMag) end
            api:setAmmoInBarrel(0)
            nbt:putString("GunId", targetGunId)
            
            if nbt:contains("SavedUglAmmo") then
                local savedUgl = nbt:getInt("SavedUglAmmo")
                if savedUgl > 1 then savedUgl = 1 end
                if savedUgl > 0 then api:putAmmoInMagazine(savedUgl) end
                nbt:putInt("SavedUglAmmo", 0)
            end
                       
            return true
        end
    end
	
    -- ВХОД В РЕЖИМ ПОДСТВОЛЬНИКА (M203)
	if attachment == "ra1k:m203" then
        if string.sub(currentGunId, -5) ~= "_m203" then
            local targetGunId = currentGunId .. "_m203"
            local bulletsInMag = api:getAmmoCountInMagazine()
            
            nbt:putInt("SavedBulletCount", bulletsInMag)
            nbt:putInt("NeedRestoreAmmo", 0)

            if bulletsInMag > 0 then api:removeAmmoFromMagazine(bulletsInMag) end
            api:setAmmoInBarrel(0)
            nbt:putString("GunId", targetGunId)
            
            if nbt:contains("SavedUglAmmo") then
                local savedUgl = nbt:getInt("SavedUglAmmo")
                if savedUgl > 1 then savedUgl = 1 end
                if savedUgl > 0 then api:putAmmoInMagazine(savedUgl) end
                nbt:putInt("SavedUglAmmo", 0)
            end
            
           
            return true
        end
    end

    -- ВЫХОД ИЗ РЕЖИМА ПОДСТВОЛЬНИКА
    if attachment == "tacz:empty" or attachment == nil or attachment == "" then
        if string.sub(currentGunId, -5) == "_gp25" or string.sub(currentGunId, -5) == "_m203" then
            local targetGunId = string.sub(currentGunId, 1, -6)
            local currentUglAmmo = api:getAmmoCountInMagazine()
            
            nbt:putInt("SavedUglAmmo", currentUglAmmo)
            
            if currentUglAmmo > 0 then api:removeAmmoFromMagazine(api:getAmmoCountInMagazine()) end
            api:setAmmoInBarrel(0)
            nbt:putString("GunId", targetGunId)
            nbt:putInt("NeedRestoreAmmo", 1)
            
           
            return true
        end
    end
	if nbt:contains("AttachmentSCOPE") then
        local scopeCompound = nbt:getCompound("AttachmentSCOPE")
        if scopeCompound:contains("tag") then
            local tagCompound = scopeCompound:getCompound("tag")
            local currentScopeId = tagCompound:getString("AttachmentId")

            local aimingProgress = api:getAimingProgress() or 0
            if aimingProgress > 0.9 then 
                local scopeChanged = false

                if currentScopeId == "ra1k:sight_eotech_hhs1_nozoom" then
                    tagCompound:putString("AttachmentId", "ra1k:sight_eotech_hhs1")
                    scopeChanged = true
                elseif currentScopeId == "ra1k:sight_eotech_hhs1" then
                    tagCompound:putString("AttachmentId", "ra1k:sight_eotech_hhs1_nozoom")
                    scopeChanged = true
                end

                -- Если прицел был изменен, мы принудительно возвращаем false, 
                -- чтобы прервать стандартную логику перезарядки (которая требует патроны)
                if scopeChanged then
                    local entity = api:getEntityUtil()
                    -- Возвращаем false, чтобы перезарядка оружия не блокировала смену прицела из-за отсутствия патронов
                    return false 
                end
            end
        end
	end
end
	

-----------------------------------------------------------------
-- ХУК ТИКА ПЕРЕЗАРЯДКИ
-----------------------------------------------------------------
function M.tick_reload(api)
    local nbt = api:getNbt()
    local attachment = api:getAttachment("GRIP")
    local mag_level = math.min(api:getMagExtentLevel(), 3) + 1
    local halfMax = getSingleMagMax(api)

    -- ИЗМЕНЕНИЕ: Убран старый костыльный блок проверки лимита патронов для обычного автомата,
    -- который каждый тик принудительно вызывал removeAmmoFromMagazine().

    -- Восстановление патронов при переключении обратно на автомат
    if nbt ~= nil and (attachment ~= "ra1k:gp25" and attachment ~= "ra1k:m203") then
        if nbt:getInt("NeedRestoreAmmo") == 1 then
            if nbt:contains("SavedBulletCount") then
                local savedBullets = nbt:getInt("SavedBulletCount")
                if savedBullets > 0 then api:putAmmoInMagazine(savedBullets) end
            end
            nbt:putInt("NeedRestoreAmmo", 0)
        end
    end

    local param = api:getScriptParams()
    local progressTime = api:getReloadTime()

    -- ДИНАМИЧЕСКИЙ ТИК ДЛЯ ПОДСТВОЛЬНИКА (ГП-25 / M203)
    if attachment == "ra1k:gp25" or attachment == "ra1k:m203" then
        if api:getAmmoCountInMagazine() > 1 then
            api:removeAmmoFromMagazine(api:getAmmoCountInMagazine() - 1)
        end

        local reload_feed = toMs(param.reload_feed) or 1000
        local reload_cooldown = toMs(param.reload_cooldown) or 1500
        
        local stateType = 0
        local countDown = -1
        local oldStateType = api:getReloadStateType()
        local is_tactical = not isReloadingEmpty(oldStateType)

        if progressTime < reload_feed then
            stateType = is_tactical and 3 or 1
            countDown = reload_feed - progressTime
        elseif progressTime < reload_cooldown then
            stateType = is_tactical and 4 or 2
            countDown = reload_cooldown - progressTime
        else
            stateType = 0
            countDown = -1
        end

        if (oldStateType == 1 or oldStateType == 3) and oldStateType ~= stateType then
            finishReload(api, is_tactical)
        end

        return stateType, countDown
    end

    -----------------------------------------------------------------
    -- СТАНДАРТНАЯ СТЕЙТ-МАШИНА ДЛЯ ОБЫЧНОГО АВТОМАТА
    -----------------------------------------------------------------
    local reload_feed, reload_cooldown, empty_feed, empty_cooldown = getReloadTimingFromParam(param)
    if (reload_feed == nil or reload_cooldown == nil or empty_feed == nil or empty_cooldown == nil) then return 0, -1 end

    local countDown = -1
    local stateType = 0 
    local oldStateType = api:getReloadStateType()
    local current_feed_time = 0
    local current_finishing_time = 0

    if isReloadingEmpty(oldStateType) then
        current_feed_time = empty_feed[mag_level]
        current_finishing_time = empty_cooldown[mag_level]
    else
        current_feed_time = reload_feed[mag_level]
        current_finishing_time = reload_cooldown[mag_level]
    end

    if isReloadingEmpty(oldStateType) then
        if progressTime < current_feed_time then
            stateType = 1
            countDown = current_feed_time - progressTime
        elseif progressTime < current_finishing_time then
            stateType = 2
            countDown = current_finishing_time - progressTime
        else
            stateType = 0
            countDown = -1
        end
    elseif isReloadingTactical(oldStateType) then
        if progressTime < current_feed_time then
            stateType = 3
            countDown = current_feed_time - progressTime
        elseif progressTime < current_finishing_time then
            stateType = 4
            countDown = current_finishing_time - progressTime
        else
            stateType = 0
            countDown = -1
        end
    else
        stateType = 0
        countDown = -1
    end

    if oldStateType == 1 and oldStateType ~= stateType then finishReload(api, false) end
    if oldStateType == 3 and oldStateType ~= stateType then finishReload(api, true) end

    return stateType, countDown
end

return M