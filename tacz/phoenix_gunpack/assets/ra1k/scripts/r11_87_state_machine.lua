-- 脚本的位置是 "{命名空间}:{路径}"，那么 require 的格式为 "{命名空间}_{路径}"
-- 注意！require 取得的内容不应该被修改，应仅调用
local default = require("ra1k_default_state_machine")
local STATIC_TRACK_LINE = default.STATIC_TRACK_LINE
local GUN_KICK_TRACK_LINE = default.GUN_KICK_TRACK_LINE
local MAIN_TRACK = default.MAIN_TRACK
local main_track_states = default.main_track_states
local static_track_top = default.static_track_top
-- main_track_states.idle 是我们要重写的状态。
local idle_state = setmetatable({}, {__index = main_track_states.idle})

local shoot_state = {}

function shoot_state.transition(this, context, input)
    -- 玩家按下开火键时需要在射击轨道行里寻找空闲轨道去播放射击动画(如果没有空闲会分配新的),需要注意的是射击动画要向下混合
    if (input == INPUT_SHOOT) then
        local track = context:findIdleTrack(GUN_KICK_TRACK_LINE, false)
        -- 这里是混合动画，一般是可叠加的 gun kick
        if (context:getAmmoCount() == 0) then
            context:runAnimation("shoot_last", track, true, PLAY_ONCE_STOP, 0)
        else
            context:runAnimation("shoot", track, true, PLAY_ONCE_STOP, 0)
        end
    end
    return nil
end


local VALID_HANDGUARDS = {
    ["ra1k:handguard_green"] = true,
    ["ra1k:handguard_green_laser"] = true,
    ["ra1k:handguard_red"]   = true,
    ["ra1k:handguard_red_laser"]   = true,
    ["ra1k:handguard_sand"]  = true,
    ["ra1k:handguard_sand_laser"]  = true,
    ["ra1k:handguard_grey"]  = true,
    ["ra1k:handguard_grey_laser"]  = true,
}

local function hasCustomHandguard(context)
    local current_laser = context:getAttachment("LASER")
    return VALID_HANDGUARDS[current_laser] == true
end

local reload_state = {
    need_ammo = 0,
    loaded_ammo = 0
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

local function increment(obj)
    obj.value = obj.value + 1
    return obj.value - 1
end

local HANDGUARD_TRACK = increment(static_track_top) 


local handguard_state = { state_true = {}, state_false = {}, draw = {} }
function handguard_state.draw.update(this, context) context:trigger("INPUT_HG_DRAW") end
function handguard_state.draw.transition(this, context, input)
    if (input == "INPUT_HG_DRAW") then
        local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
        if (hasCustomHandguard(context)) then
            context:runAnimation("handguard_true", track, true, PLAY_ONCE_HOLD, 0)
            return handguard_state.state_true
        else
            context:runAnimation("handguard_false", track, true, PLAY_ONCE_HOLD, 0)
            return handguard_state.state_false
        end
    end
end
function handguard_state.state_true.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
    if (context:isHolding(track)) then context:runAnimation("handguard_true", track, true, PLAY_ONCE_HOLD, 0) end
    if (not hasCustomHandguard(context)) then context:trigger("INPUT_HG_FALSE") end
end
function handguard_state.state_true.transition(this, context, input)
    if (input == "INPUT_HG_FALSE") then
        local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
        context:runAnimation("handguard_false", track, true, PLAY_ONCE_HOLD, 0)
        return handguard_state.state_false
    end
end
function handguard_state.state_false.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
    if (context:isHolding(track)) then context:runAnimation("handguard_false", track, true, PLAY_ONCE_HOLD, 0) end
    if (hasCustomHandguard(context)) then context:trigger("INPUT_HG_TRUE") end
end
function handguard_state.state_false.transition(this, context, input)
    if (input == "INPUT_HG_TRUE") then
        local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
        context:runAnimation("handguard_true", track, true, PLAY_ONCE_HOLD, 0)
        return handguard_state.state_true
    end
end



-- 重写 idle 状态的 transition 函数，将输入 INPUT_RELOAD 重定向到新定义的 reload_state 状态
function idle_state.transition(this, context, input)
    if (input == INPUT_RELOAD) then
        return this.main_track_states.reload
    end
    return main_track_states.idle.transition(this, context, input)
end
-- 在 entry 函数里，我们根据情况选择播放 'reload_intro_empty' 或 'reload_intro' 动画，
-- 并初始化 需要的弹药数、已装填的弹药数。这决定了后续的 'loop' 动画进行几次循环。
function reload_state.entry(this, context)
    local state = this.main_track_states.reload
	local isNoAmmo = not context:hasBulletInBarrel()
	if hasValidGrip(context) then
		if (isNoAmmo) then
			context:runAnimation("reload_intro_empty_grip", context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK), false, PLAY_ONCE_HOLD, 0.2)
		else
			context:runAnimation("reload_intro_grip", context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK), false, PLAY_ONCE_HOLD, 0.2)
		end
	else		
		if (isNoAmmo) then
			context:runAnimation("reload_intro_empty", context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK), false, PLAY_ONCE_HOLD, 0.2)
		else
			context:runAnimation("reload_intro", context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK), false, PLAY_ONCE_HOLD, 0.2)
		end
	end
    state.need_ammo = context:getMaxAmmoCount() - context:getAmmoCount()
    state.loaded_ammo = 0
end
-- 在 update 函数里，循环播放 loop，让 loaded_ammo 变量自增。
function reload_state.update(this, context)
    local state = this.main_track_states.reload
    if (state.loaded_ammo > state.need_ammo or not context:hasAmmoToConsume()) then
        context:trigger(this.INPUT_RELOAD_RETREAT)
    else 
		local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
		if (context:isHolding(track)) then
			context:runAnimation("reload_loop", track, false, PLAY_ONCE_HOLD, 0)
			state.loaded_ammo = state.loaded_ammo + 1	
		end	
	end
end

-- 如果 loop 循环结束或者换弹被打断，退出到 idle 状态。否则由 idle 的 transition 函数决定下一个状态。
function reload_state.transition(this, context, input)
	if hasValidGrip(context) then
		if (input == this.INPUT_RELOAD_RETREAT or input == INPUT_CANCEL_RELOAD) then
			context:runAnimation("reload_end_grip", context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK), false, PLAY_ONCE_STOP, 0.2)
			return this.main_track_states.idle
		end
	else
		if (input == this.INPUT_RELOAD_RETREAT or input == INPUT_CANCEL_RELOAD) then
			context:runAnimation("reload_end", context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK), false, PLAY_ONCE_STOP, 0.2)
			return this.main_track_states.idle
		end
	end
    return this.main_track_states.idle.transition(this, context, input)
end

-- 用元表的方式继承默认状态机的属性
local M = setmetatable({
    main_track_states = setmetatable({
        idle = idle_state,
        reload = reload_state	
    }, {__index = main_track_states}),
    gun_kick_state = shoot_state,
	handguard_state = handguard_state,
	HANDGUARD_TRACK = HANDGUARD_TRACK,
	GRIP_BLACKLIST = GRIP_BLACKLIST,
    INPUT_RELOAD_RETREAT = "reload_retreat"
}, {__index = default})
-- 先调用父级状态机的初始化函数，然后进行自己的初始化
function M:initialize(context)
    default.initialize(self, context)
    self.main_track_states.reload.need_ammo = 0
    self.main_track_states.reload.loaded_ammo = 0
end

function M:states()
    return {
        self.base_track_state,
        self.bolt_caught_states.normal,
        self.main_track_states.start,
        self.gun_kick_state,
        self.movement_track_states.idle,
        self.ADS_states.normal,
        self.slide_states.normal,
        self.handguard_state.draw
    }
end

-- 导出状态机
return M