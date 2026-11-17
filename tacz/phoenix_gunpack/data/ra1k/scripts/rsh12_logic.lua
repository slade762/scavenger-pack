local M = {}


local NOT_RELOADING = 0
local EMPTY_RELOAD_FEEDING = 1
local EMPTY_RELOAD_FINISHING = 2
local TACTICAL_RELOAD_FEEDING = 3
local TACTICAL_RELOAD_FINISHING = 4

local function isReloadingEmpty(stateType)
    return stateType == EMPTY_RELOAD_FEEDING or stateType == EMPTY_RELOAD_FINISHING
end

local function isReloadingTactical(stateType)
    return stateType == TACTICAL_RELOAD_FEEDING or stateType == TACTICAL_RELOAD_FINISHING
end

local function getReloadTimingFromParam(api, param)
    -- Сколько патронов нужно зарядить (ограничиваем от 1 до 5)
    local needed = api:getNeededAmmoAmount()
    local count = math.min(math.max(needed, 1), 5)

    -- Читаем reload_1_feed .. reload_5_feed и reload_1_cooldown .. reload_5_cooldown
    local feed_key = "reload_" .. count .. "_feed"
    local cooldown_key = "reload_" .. count .. "_cooldown"

    -- Если параметр не найден в JSON, используем дефолтные reload_feed / reload_cooldown
    local feed_sec = param[feed_key] or param.reload_feed or 1.0
    local cooldown_sec = param[cooldown_key] or param.reload_cooldown or 1.5

    -- Для пустой перезарядки используем empty_feed / empty_cooldown (или берем обычные)
    local empty_feed_sec = param.empty_feed or feed_sec
    local empty_cooldown_sec = param.empty_cooldown or cooldown_sec

    -- Переводим в миллисекунды
    return feed_sec * 1000, cooldown_sec * 1000, empty_feed_sec * 1000, empty_cooldown_sec * 1000
end

function M.tick_heat(api, heatTimestamp)
    local nbt = api:getNbt()
    if nbt == nil then return end

    local currentGunId = nbt:getString("GunId")
    if currentGunId == nil or currentGunId == "" then return true end
	
	local attachment = api:getAttachment("GRIP")
	local muzzle = api:getAttachment("MUZZLE")
	
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
end

local function finishReload(api)
    local needAmmoCount = api:getNeededAmmoAmount()
    if api:isReloadingNeedConsumeAmmo() then
        local consumed = api:consumeAmmoFromPlayer(needAmmoCount)
        api:putAmmoInMagazine(consumed)
    else
        api:putAmmoInMagazine(needAmmoCount)
    end
end

function M.start_reload(api)
    return true
end

function M.tick_reload(api)
    local param = api:getScriptParams()
    local feed_time, cooldown_time, empty_feed_time, empty_cooldown_time = getReloadTimingFromParam(api, param)

    local countDown = -1
    local stateType = NOT_RELOADING
    local oldStateType = api:getReloadStateType()
    local progressTime = api:getReloadTime()

    if isReloadingEmpty(oldStateType) then
        if progressTime < empty_feed_time then
            stateType = EMPTY_RELOAD_FEEDING
            countDown = empty_feed_time - progressTime
        elseif progressTime < empty_cooldown_time then
            stateType = EMPTY_RELOAD_FINISHING
            countDown = empty_cooldown_time - progressTime
        else
            stateType = NOT_RELOADING
            countDown = -1
        end
    elseif isReloadingTactical(oldStateType) then
        if progressTime < feed_time then
            stateType = TACTICAL_RELOAD_FEEDING
            countDown = feed_time - progressTime
        elseif progressTime < cooldown_time then
            stateType = TACTICAL_RELOAD_FINISHING
            countDown = cooldown_time - progressTime
        else
            stateType = NOT_RELOADING
            countDown = -1
        end
    else
        stateType = NOT_RELOADING
        countDown = -1
    end

    -- Завершение фазы подачи патронов (переход из FEEDING в FINISHING или NOT_RELOADING)
    if (oldStateType == EMPTY_RELOAD_FEEDING or oldStateType == TACTICAL_RELOAD_FEEDING) and oldStateType ~= stateType then
        finishReload(api)
    end

    return stateType, countDown
end

return M