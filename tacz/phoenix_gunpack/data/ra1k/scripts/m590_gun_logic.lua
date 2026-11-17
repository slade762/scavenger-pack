local M = {}

function M.shoot(api)
    api:shootOnce(api:isShootingNeedConsumeAmmo())
end

function M.start_bolt(api)
    return true
end

function M.tick_bolt(api)
    local params = api:getScriptParams()
    local total_bolt_time = params.bolt_time * 1000
    local bolt_feed_time = params.bolt_feed_time * 1000
    if (total_bolt_time == nil or bolt_feed_time == nil) then
        return false
    end
    local bolt_time = api:getBoltTime()
    if (bolt_time < bolt_feed_time) then
        return true
    else
        if (not api:hasAmmoInBarrel()) then
            if (api:removeAmmoFromMagazine(1) ~= 0) then
                api:setAmmoInBarrel(true);
            end
        end
        return bolt_time < total_bolt_time
    end
end

function M.tick_heat(api, heatTimestamp)
    local nbt = api:getNbt()
    if nbt == nil then return end
  
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
			
        end
    end	
end

function M.start_reload(api)
	local nbt = api:getNbt()
    if nbt == nil then return true end

    local currentGunId = nbt:getString("GunId")
    if currentGunId == nil or currentGunId == "" then return true end   
	
    local cache = {
        reloaded_count = 0,
        needed_count = api:getNeededAmmoAmount(),
        is_tactical = api:getReloadStateType() == TACTICAL_RELOAD_FEEDING,
        interrupted_time = -1,
    }
    api:cacheScriptData(cache)
    return true
end

local function getReloadTimingFromParam(param)
    local intro_empty = param.intro_empty * 1000
    local intro = param.intro * 1000
    local loop = param.loop * 1000
    local ending = param.ending * 1000
    local intro_empty_feed = param.intro_empty_feed * 1000
    local loop_feed = param.loop_feed * 1000
    -- Также добавим параметры для обычной перезарядки (если они есть в JSON)
    local normal_empty = (param.normal_empty or 0) * 1000
    local normal_tactical = (param.normal_tactical or 0) * 1000

    if (intro_empty == nil or intro == nil or loop == nil or ending == nil or intro_empty_feed == nil or loop_feed == nil) then
        return nil
    end
    return intro_empty, intro, loop, ending, intro_empty_feed, loop_feed, normal_empty, normal_tactical
end

function M.tick_reload(api)
    local param = api:getScriptParams();
    local intro_empty, intro, loop, ending, intro_empty_feed, loop_feed, normal_empty, normal_tactical = getReloadTimingFromParam(param)
    
    local ext = api:getMagExtentLevel() 
    local reload_time = api:getReloadTime()
    local cache = api:getCachedScriptData()

    -- Если магазин 2 уровня, используем упрощенную логику
    if (ext == 2) then
        local total_time = cache.is_tactical and (normal_tactical or 2000) or (normal_empty or 3000)
        
        if (reload_time >= total_time) then
            -- Важно: сначала заправляем, потом завершаем
            local amount = api:getNeededAmmoAmount()
            if (amount > 0) then
                api:consumeAmmoFromPlayer(amount)
                api:putAmmoInMagazine(amount)
            end
            if not cache.is_tactical then
                 api:setAmmoInBarrel(true)
				 api:removeAmmoFromMagazine(1)
            end
            return NOT_RELOADING, -1
        end
        -- Возвращаем стандартное состояние завершения
        return cache.is_tactical and TACTICAL_RELOAD_FINISHING or EMPTY_RELOAD_FINISHING, total_time - reload_time
    end

    -- СТАНДАРТНАЯ ПОПАТРОННАЯ ПЕРЕЗАРЯДКА (ваш исходный код)
    local interrupted_time = cache.interrupted_time
    if (interrupted_time ~= -1) then
        local int_time = reload_time - interrupted_time
        if (int_time >= ending) then
            return NOT_RELOADING, -1
        else
            if (cache.is_tactical) then
                return TACTICAL_RELOAD_FINISHING, ending - int_time
            else
                return EMPTY_RELOAD_FINISHING, ending - int_time
            end
        end
    else
        if (not api:hasAmmoToConsume()) then
            interrupted_time = api:getReloadTime()
        end
    end

    local reloaded_count = cache.reloaded_count;
    if (reloaded_count == 0) then
        if (not cache.is_tactical) then
            if (reload_time > intro_empty_feed) then
                api:consumeAmmoFromPlayer(1)
                api:setAmmoInBarrel(true)
                reloaded_count = reloaded_count + 1
            end
        else
            reloaded_count = reloaded_count + 1
        end
    end

    if (reloaded_count > 0) then
        local base_time = (reloaded_count - 1) * loop + loop_feed
        if (not cache.is_tactical) then
            base_time = base_time + intro_empty
        else
            base_time = base_time + intro
        end
        while (base_time < reload_time) do
            if (reloaded_count > cache.needed_count) then
                break
            end
            reloaded_count = reloaded_count + 1
            base_time = base_time + loop
            api:consumeAmmoFromPlayer(1)
            api:putAmmoInMagazine(1)
        end
    end

    if (reloaded_count > cache.needed_count) then
        interrupted_time = api:getReloadTime() - loop_feed + loop
    end
    cache.interrupted_time = interrupted_time
    cache.reloaded_count = reloaded_count
    api:cacheScriptData(cache)

    local total_time_loop = cache.needed_count * loop
    if (not cache.is_tactical) then
        total_time_loop = total_time_loop + intro_empty
        return EMPTY_RELOAD_FEEDING, total_time_loop - reload_time
    else
        total_time_loop = total_time_loop + intro
        return TACTICAL_RELOAD_FEEDING, total_time_loop - reload_time
    end
end

function M.interrupt_reload(api)
    local cache = api:getCachedScriptData()
    if (cache ~= nil and cache.interrupted_time == -1) then
        cache.interrupted_time = api:getReloadTime()
    end
end

return M