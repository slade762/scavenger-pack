-- 脚本的位置是 "{命名空间}:{路径}"，那么 require 的格式为 "{命名空间}_{路径}"
-- 注意！require 取得的内容不应该被修改，应仅调用
local default = require("ra1k_bolt_state_machine")
local STATIC_TRACK_LINE = default.STATIC_TRACK_LINE
local MAIN_TRACK = default.MAIN_TRACK
local main_track_states = default.main_track_states

local idle_state = setmetatable({}, {__index = main_track_states.idle})
local reload_state = {
    need_ammo = 0,
	timestamp = -1,
    loaded_ammo = 0,
	ejection_time = 0.5,
    is_normal_reload = false
}

-- Создаем таблицу для состояния осмотра, чтобы хранить там флаги
local inspect_state = {
    is_mag_inspect = false
}


local GRIP_BLACKLIST = {
    ["tacz:grip_cobra"] = true, 
	["tacz:grip_rk6"] = true, 
	["tacz:grip_magpul_afg_2"] = true,
	["tacz:grip_magpul_afg"] = true,	
    ["tacz:grip_troy"] = true, 	
	
	["gucci_attachments:grip_angled3"] = true,
	["gucci_attachments:grip_vg1"] = true,
	["gucci_attachments:grip_rk6"] = true,
	["gucci_attachments:grip_phase"] = true,
	["gucci_attachments:grip_anchorage"] = true,
	["gucci_attachments:grip_bojin1"] = true,
	
	["atea:grip_zolfaqar_gh"] = true,
	["atea:grip_utg_usa"] = true,
	["atea:grip_lb1"] = true,
	["atea:grip_sigurd"] = true,
	["atea:grip_shiftshort"] = true,
	
	["suffuse:pistollaser"] = true,
	["ra1k:ugl"] = true,
	["ra1k:gp25"] = true,
	["ra1k:m203"] = true,
	
	["nmw1:grip_tf_ziptie"] = true,
    ["nmw2:grip_tiger"] = true, 
	["nmw1:grip_cf_twos"] = true, 
	["nmw2:grip_agent_crater_maker"] = true, 
	["nmw2:grip_ftac_ripper_56_tb"] = true, 
	["nmw3:grip_paracord_grip"] = true, 
}

local function hasValidGrip(context)
    local current_grip = context:getAttachment("GRIP")
    -- Возвращает true, если рукоятка есть И её нет в черном списке
    return current_grip ~= "tacz:empty" and not GRIP_BLACKLIST[current_grip]
end



-------------------------------
--- Вспомогательные функции (ДОЛЖНЫ БЫТЬ ВЫШЕ ВЫЗОВА)
-------------------------------

local function get_ejection_time(context)
    local ejection_time = context:getStateMachineParams().intro_shell_ejecting_time
    if (ejection_time) then
        ejection_time = ejection_time * 1000
    else
        ejection_time = 0
    end
    return ejection_time
end

-- Переносим определение вверх, чтобы избежать ошибки "call a nil value"
local function runInspectAnimation(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK) 
    local ext = context:getMagExtentLevel()
    -- Определяем отсутствие патронов (аналогично логике перезарядки)
    local isNoAmmo = not context:hasBulletInBarrel() and context:getAmmoCount() <= 0

    if (ext == 2) then
        if hasValidGrip(context) then
            if (isNoAmmo) then
                context:runAnimation("inspect_mag_grip", track, false, PLAY_ONCE_STOP, 0.2)
            else
                context:runAnimation("inspect_mag_grip", track, false, PLAY_ONCE_STOP, 0.2)
            end
        else
            if (isNoAmmo) then
                context:runAnimation("inspect_mag", track, false, PLAY_ONCE_STOP, 0.2)
            else
                -- Исправлено: заменено с inspect_grip на inspect_mag
                context:runAnimation("inspect_mag", track, false, PLAY_ONCE_STOP, 0.2)
            end
        end
    else
        -- Стандартная логика для обычного магазина (по одному патрону)
        if hasValidGrip(context) then
            if (isNoAmmo) then
                context:runAnimation("inspect_empty_grip", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (context:getAmmoCount() <= 0) then
				context:runAnimation("inspect_01_grip", track, false, PLAY_ONCE_STOP, 0.2)
            else
                context:runAnimation("inspect_grip", track, false, PLAY_ONCE_STOP, 0.2)
            end
        else
            if (isNoAmmo) then
                context:runAnimation("inspect_empty", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (context:getAmmoCount() <= 0) then
				context:runAnimation("inspect_01", track, false, PLAY_ONCE_STOP, 0.2)
            else
                context:runAnimation("inspect", track, false, PLAY_ONCE_STOP, 0.2)
            end
        end
    end
end

-------------------------------
--- Логика состояний
-------------------------------


function idle_state.transition(this, context, input)
    if (input == INPUT_RELOAD) then
        return this.main_track_states.reload
    end
    -- Теперь функция runInspectAnimation определена и вылета не будет
    if (input == INPUT_INSPECT) then
        runInspectAnimation(this, context)
        return this.main_track_states.inspect
    end
    return main_track_states.idle.transition(this, context, input)
end

function reload_state.entry(this, context)
    local state = this.main_track_states.reload
    local isNoAmmo = not context:hasBulletInBarrel()
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
    
    state.loaded_ammo = 0
    state.need_ammo = context:getMaxAmmoCount() - context:getAmmoCount()
    
    if (ext == 2) then
        state.is_normal_reload = true -- Используем флаг для пропуска reload_end
        local isEmpty = not context:hasBulletInBarrel() and context:getAmmoCount() <= 0
        
        if hasValidGrip(context) then
            context:runAnimation(isEmpty and "reload_mag_empty_grip" or "reload_mag_grip", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation(isEmpty and "reload_mag_empty" or "reload_mag", track, false, PLAY_ONCE_STOP, 0.2)
        end
    else
        state.is_normal_reload = false
        if hasValidGrip(context) then
            if (isNoAmmo) then
                state.timestamp = context:getCurrentTimestamp()
                state.ejection_time = get_ejection_time(context)
                context:runAnimation("reload_intro_empty_grip", track, false, PLAY_ONCE_HOLD, 0.2)
            else
                state.timestamp = -1
                state.ejection_time = 0
                context:runAnimation("reload_intro_grip", track, false, PLAY_ONCE_HOLD, 0.2)
            end
        else 
            if (isNoAmmo) then
                state.timestamp = context:getCurrentTimestamp()
                state.ejection_time = get_ejection_time(context)
                context:runAnimation("reload_intro_empty", track, false, PLAY_ONCE_HOLD, 0.2)
            else
                state.timestamp = -1
                state.ejection_time = 0
                context:runAnimation("reload_intro", track, false, PLAY_ONCE_HOLD, 0.2)
            end
        end
    end
	if (context:getAttachment("SCOPE") == "ra1k:sight_eotech_hhs1_nozoom" or context:getAttachment("SCOPE") == "ra1k:sight_eotech_hhs1") and (context:getAimingProgress()) == 1 then
		context:runAnimation("non", track, false, PLAY_ONCE_STOP, 0.2)
	end
end

function reload_state.update(this, context)
    local state = this.main_track_states.reload
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
    local rel = context:getReloadStateType()

    -- Если магазин 2 уровня — ждем окончания анимации (rel == 0)

    if (state.timestamp ~= -1 and context:getCurrentTimestamp() - state.timestamp > state.ejection_time) then
        context:popShellFrom(0)
        state.timestamp = -1
    end
    if (state.loaded_ammo > state.need_ammo or not context:hasAmmoToConsume()) then
        context:trigger(this.INPUT_RELOAD_RETREAT)
    else
        if (context:isHolding(track)) then
            context:runAnimation("reload_loop", track, false, PLAY_ONCE_HOLD, 0)
            state.loaded_ammo = state.loaded_ammo + 1
        end
    end
end

function reload_state.transition(this, context, input)
    local state = this.main_track_states.reload
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)

    if (input == this.INPUT_RELOAD_RETREAT or input == INPUT_CANCEL_RELOAD) then
        -- Если это "магазинная" перезарядка, выходим в idle мгновенно
        if (state.is_normal_reload) then
            return this.main_track_states.idle
        end

        if (context:getAttachment("GRIP") ~= "tacz:empty") then
            context:runAnimation("reload_end_grip", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("reload_end", track, false, PLAY_ONCE_STOP, 0.2)
        end
        return this.main_track_states.idle
    end
    return this.main_track_states.idle.transition(this, context, input)
end

local gun_kick_state = {}

function gun_kick_state.transition(this, context, input)
    -- 玩家按下开火键时需要在射击轨道行里寻找空闲轨道去播放射击动画(如果没有空闲会分配新的),需要注意的是射击动画要向下混合
    if (input == INPUT_SHOOT) then
        local track = context:findIdleTrack(GUN_KICK_TRACK_LINE, false)
		if context:hasBulletInBarrel() and context:getAmmoCount() == 0 then
			context:runAnimation("shoot_last", track, true, PLAY_ONCE_STOP, 0)
		else
			context:runAnimation("shoot", track, true, PLAY_ONCE_STOP, 0)
		end
    end
    return nil
end




local M = setmetatable({
    -- Привязываем ваше измененное состояние стрельбы  
    
    main_track_states = setmetatable({
        idle = idle_state,
        reload = reload_state,
        inspect = setmetatable(inspect_state, {__index = main_track_states.inspect})
    }, {__index = main_track_states}),
    INPUT_RELOAD_RETREAT = "reload_retreat",
	GRIP_BLACKLIST = GRIP_BLACKLIST,
}, {__index = default})

function M:initialize(context)
    default.initialize(self, context)
    self.main_track_states.reload.need_ammo = 0
    self.main_track_states.reload.loaded_ammo = 0
end


return M