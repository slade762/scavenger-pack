-- 脚本的位置是 "{命名空间}:{路径}"，那么 require 的格式为 "{命名空间}_{路径}"
-- 注意！require 取得的内容不应该被修改，应仅调用
local default = require("ra1k_default_state_machine")
local STATIC_TRACK_LINE = default.STATIC_TRACK_LINE
local MAIN_TRACK = default.MAIN_TRACK
local main_track_states = default.main_track_states
local static_track_top = default.static_track_top

local inspect_state = setmetatable({}, {__index = main_track_states.inspect})
local idle_state = setmetatable({}, {__index = main_track_states.idle})

local VALID_HANDGUARDS = {
    ["ra1k:handguard_green"] = true,
	["ra1k:handguard_green_laser"] = true,
    ["ra1k:handguard_red"]   = true,
	["ra1k:handguard_red_laser"]   = true,
    ["ra1k:handguard_sand"]  = true,
	["ra1k:handguard_sand_laser"]  = true,
	["ra1k:handguard_grey"]  = true,
	["ra1k:handguard_grey_laser"]  = true,
    -- ["ra1k:handguard_black"] = true, -- пример для будущего
}

-- Функция проверки: установлено ли какое-то из кастомных цевьев в слот LASER
local function hasCustomHandguard(context)
    local current_laser = context:getAttachment("LASER")
    return VALID_HANDGUARDS[current_laser] == true
end
-- ============================================================================
-- НАСТРОЙКА ЦЕВЬЕВ (СПИСОК МОДУЛЕЙ)
-- ============================================================================
-- Сюда просто добавляйте через запятую все новые модули, которые должны активировать handguard_true
-- ============================================================================
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

-- 相当于 obj.value++
local function increment(obj)
    obj.value = obj.value + 1
    return obj.value - 1
end

-- Регистрируем новые треки анимаций
local FIRE_MODE_TRACK = increment(static_track_top)
local SWITCH_MODE_TRACK = increment(static_track_top)
local HANDGUARD_TRACK = increment(static_track_top) -- Выделенный трек для цевья

-- 检查当前是否还有弹药
local function isNoAmmo(context)
    -- 这里同时检查了枪管和弹匣
    return (not context:hasBulletInBarrel()) and (context:getAmmoCount() <= 0)
end

local function runReloadAnimation(context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
	if hasValidGrip(context) then
		if (isNoAmmo(context)) then
			if (ext == 0) then
				context:runAnimation("reload_empty_grip", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 2) then
				context:runAnimation("reload_empty_xmag_grip", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 3) then
				context:runAnimation("reload_empty_drum_grip", track, false, PLAY_ONCE_STOP, 0.2)
			else
				context:runAnimation("reload_empty_grip", track, false, PLAY_ONCE_STOP, 0.2)
			end
		else
			if (ext == 0) then
				context:runAnimation("reload_tactical_grip", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 2) then
				context:runAnimation("reload_tactical_xmag_grip", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 3) then
				context:runAnimation("reload_tactical_drum_grip", track, false, PLAY_ONCE_STOP, 0.2)
			else
				context:runAnimation("reload_tactical_grip", track, false, PLAY_ONCE_STOP, 0.2)
			end
		end	
	else
		if (isNoAmmo(context)) then
        -- "ext"表示扩容插件等级,"0"代表不装扩容插件
			if (ext == 0) then
				context:runAnimation("reload_empty", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 2) then
				context:runAnimation("reload_empty_xmag", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 3) then
				context:runAnimation("reload_empty_drum", track, false, PLAY_ONCE_STOP, 0.2)
			else
				context:runAnimation("reload_empty", track, false, PLAY_ONCE_STOP, 0.2)
			end
		else
			if (ext == 0) then
				context:runAnimation("reload_tactical", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 2) then
				context:runAnimation("reload_tactical_xmag", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 3) then
				context:runAnimation("reload_tactical_drum", track, false, PLAY_ONCE_STOP, 0.2)
			else
				context:runAnimation("reload_tactical", track, false, PLAY_ONCE_STOP, 0.2)
			end
		end
	end
	if context:getFireMode() == UNKNOWN then
        context:runAnimation("jam", track, false, PLAY_ONCE_STOP, 0.2)
    end
end




local function runInspectAnimation(context)
    -- 此处获取的轨道是位于主轨道行上的主轨道
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
	if hasValidGrip(context) then
    -- 根据当前整枪内是否还有弹药决定是播放普通检视还是空枪检视
		if (isNoAmmo(context)) then
        -- "ext"表示扩容插件等级,"0"代表不装扩容插件
			if (ext == 2) then
				context:runAnimation("inspect_empty_grip", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 3) then
				context:runAnimation("inspect_drum_grip", track, false, PLAY_ONCE_STOP, 0.2)
			else
				context:runAnimation("inspect_empty_grip", track, false, PLAY_ONCE_STOP, 0.2)
			end
		else
			if (ext == 2) then
				context:runAnimation("inspect_grip", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 3) then
				context:runAnimation("inspect_drum_grip", track, false, PLAY_ONCE_STOP, 0.2)
			else
				context:runAnimation("inspect_grip", track, false, PLAY_ONCE_STOP, 0.2)
			end
		end
	else
		if (isNoAmmo(context)) then
        -- "ext"表示扩容插件等级,"0"代表不装扩容插件
			if (ext == 2) then
				context:runAnimation("inspect_empty", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 3) then
				context:runAnimation("inspect_drum", track, false, PLAY_ONCE_STOP, 0.2)
			else
				context:runAnimation("inspect_empty", track, false, PLAY_ONCE_STOP, 0.2)
			end
		else
			if (ext == 2)  then
				context:runAnimation("inspect", track, false, PLAY_ONCE_STOP, 0.2)
			elseif (ext == 3) then
				context:runAnimation("inspect_drum", track, false, PLAY_ONCE_STOP, 0.2)
			else
				context:runAnimation("inspect", track, false, PLAY_ONCE_STOP, 0.2)
			end
		end
	end
	if context:getFireMode() == UNKNOWN then
		if hasValidGrip(context) then
			context:runAnimation("inspect_jam_grip", track, false, PLAY_ONCE_STOP, 0.2)
		else
			context:runAnimation("inspect_jam", track, false, PLAY_ONCE_STOP, 0.2)
		end
    end
end

function idle_state.transition(this, context, input)
    if (input == INPUT_RELOAD) then
        runReloadAnimation(context)
        return this.main_track_states.idle
    end
    if (input == INPUT_PUT_AWAY) then
        local put_away_time = context:getPutAwayTime()
        -- 此处获取的轨道是位于主轨道行上的主轨道
        local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
        -- 停下切换模式动画
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
        -- 播放 put_away 动画,并且将其过渡时长设为从上下文里传入的 put_away_time * 0.75
        context:runAnimation("put_away", track, false, PLAY_ONCE_HOLD, put_away_time * 0.75)
        -- 设定动画进度为最后一帧
        context:setAnimationProgress(track, 1, true)
        -- 将动画进度向前拨动 {put_away_time}
        context:adjustAnimationProgress(track, -put_away_time, false)
        return this.main_track_states.final
    end
    if (input == INPUT_INSPECT) then
        runInspectAnimation(context)
        return inspect_state
    end
    return main_track_states.idle.transition(this, context, input)
end

-- 此处为开火模式轨道的状态,专门为快慢机动画服务,兼容其他动作,可按需求添加三种射击模式(semi、burst、auto)
local fire_mode_state = {
    -- 半自动状态
    semi = {},
    -- 全自动状态
    auto = {},
    -- 掏枪状态
    draw = {}
}
-- 这一块专门用来检测枪械在掏枪(播放draw)时枪械处于什么射击模式,并切换到对应模式的idle
function fire_mode_state.draw.update(this, context)
    context:trigger(this.INPUT_MODE_DRAW)
end

function fire_mode_state.draw.transition(this, context,input)
    if (input == this.INPUT_MODE_DRAW) then
        if (context:getFireMode() == SEMI) then
            context:runAnimation("static_semi", context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK), true, PLAY_ONCE_HOLD, 0)
            return fire_mode_state.semi
        elseif (context:getFireMode() == AUTO) then
            context:runAnimation("static_auto", context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK), true, PLAY_ONCE_HOLD, 0)
            return fire_mode_state.auto
        end
    end
end
-- 注意!后面关于每个开火模式对应状态之间的切换,需要按照data里填写的顺序进行转换
function fire_mode_state.semi.update(this, context)
    -- 当进入特定开火模式的状态时,挂起动画
    local track = context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK)
    if (context:isHolding(track)) then
        context:runAnimation("static_semi", track, true, PLAY_ONCE_HOLD, 0)
    end
    -- 为特定开火模式定义输入状态
    if (context:getFireMode() == AUTO) then
        context:trigger(this.INPUT_MODE_AUTO)
    end
end
-- 当检测 to 对应输入状态时播放对应快慢机动画
function fire_mode_state.semi.transition(this, context,input)
    if(input == this.INPUT_MODE_AUTO)then
        context:runAnimation("switch_auto", context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK), false, PLAY_ONCE_STOP, 0)
        return fire_mode_state.auto
    end
-- 检测到开火输入,换弹输入,检视输入时后停止播放动画,不然会出现两个动画在不同的轨道播放,从而出现动画衔接问题
    if(input == INPUT_SHOOT)then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if(input == INPUT_RELOAD)then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if(input == INPUT_INSPECT)then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
end
-- 和上面同理
function fire_mode_state.auto.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK)
    if (context:isHolding(track)) then
        context:runAnimation("static_auto", track, true, PLAY_ONCE_HOLD, 0)
    end
    if (context:getFireMode() == SEMI) then
        context:trigger(this.INPUT_MODE_SEMI)
    end
end

function fire_mode_state.auto.transition(this, context,input)
    if(input == this.INPUT_MODE_SEMI)then
        context:runAnimation("switch_semi", context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK), false, PLAY_ONCE_STOP, 0)
        return fire_mode_state.semi
    end
    if(input == INPUT_SHOOT)then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if(input == INPUT_RELOAD)then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if(input == INPUT_INSPECT )then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
end


-- ============================================================================
-- ОБНОВЛЕННАЯ СТРУКТУРА АНИМАЦИИ ЦЕВЬЯ С ОПТИМИЗАЦИЕЙ ПРОВЕРКИ СЛОТА LASER
-- ============================================================================
local handguard_state = {
    state_true = {},
    state_false = {},
    draw = {}
}

-- Фаза при доставании оружия
function handguard_state.draw.update(this, context)
    context:trigger("INPUT_HG_DRAW")
end

function handguard_state.draw.transition(this, context, input)
    if (input == "INPUT_HG_DRAW") then
        local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
        -- Используем глобальную функцию проверки вместо жесткого ID
        if (hasCustomHandguard(context)) then
            context:runAnimation("handguard_true", track, true, PLAY_ONCE_HOLD, 0)
            return handguard_state.state_true
        else
            context:runAnimation("handguard_false", track, true, PLAY_ONCE_HOLD, 0)
            return handguard_state.state_false
        end
    end
end

-- Состояние: Установлено любое из кастомных цевьев (handguard_true)
function handguard_state.state_true.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
    if (context:isHolding(track)) then
        context:runAnimation("handguard_true", track, true, PLAY_ONCE_HOLD, 0)
    end
    -- Если текущего модуля больше нет в списке разрешенных — переключаемся на false
    if (not hasCustomHandguard(context)) then
        context:trigger("INPUT_HG_FALSE")
    end
end

function handguard_state.state_true.transition(this, context, input)
    if (input == "INPUT_HG_FALSE") then
        local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
        context:runAnimation("handguard_false", track, true, PLAY_ONCE_HOLD, 0)
        return handguard_state.state_false
    end
end

-- Состояние: Дефолтное цевьё (handguard_false)
function handguard_state.state_false.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
    if (context:isHolding(track)) then
        context:runAnimation("handguard_false", track, true, PLAY_ONCE_HOLD, 0)
    end
    -- Если в слоте появился модуль из списка разрешенных — переключаемся на true
    if (hasCustomHandguard(context)) then
        context:trigger("INPUT_HG_TRUE")
    end
end

function handguard_state.state_false.transition(this, context, input)
    if (input == "INPUT_HG_TRUE") then
        local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
        context:runAnimation("handguard_true", track, true, PLAY_ONCE_HOLD, 0)
        return handguard_state.state_true
    end
end
-- ============================================================================




-- 当检测到开火模式切换输入时应该直接停止动画并返回闲置态
function inspect_state.transition(this, context, input)
    if (input == INPUT_FIRE_SELECT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))
        return this.main_track_states.idle
    end
    return main_track_states.inspect.transition(this, context, input)
end


-- 用元表的方式继承默认状态机的属性
local M = setmetatable({
    main_track_states = setmetatable({
        idle = idle_state,
        inspect = inspect_state
    }, {__index = main_track_states}),
    FIRE_MODE_TRACK = FIRE_MODE_TRACK,
	HANDGUARD_TRACK = HANDGUARD_TRACK,
    SWITCH_MODE_TRACK = SWITCH_MODE_TRACK,
	GRIP_BLACKLIST = GRIP_BLACKLIST,
    INPUT_MODE_SEMI = "input_mode_semi",
    INPUT_MODE_BURST = "input_mode_burst",
    INPUT_MODE_AUTO = "input_mode_auto",
    INPUT_MODE_DRAW = "input_mode_draw",
    fire_mode_state = fire_mode_state,
    handguard_state = handguard_state
}, {__index = default})

function M:initialize(context)
    default.initialize(self, context)
end
-- 继承默认状态机需要重新初始化状态
function M:states()
    return {
        self.base_track_state,
        self.bolt_caught_states.normal,
        self.main_track_states.start,
        self.gun_kick_state,
        self.movement_track_states.idle,
        self.ADS_states.normal,
        self.slide_states.normal,
        self.fire_mode_state.draw,
        self.handguard_state.draw 
    }
end
-- 导出状态机
return M