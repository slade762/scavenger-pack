local default = require("ra1k_ugl_state_machine")

local STATIC_TRACK_LINE = default.STATIC_TRACK_LINE
local MAIN_TRACK = default.MAIN_TRACK
local main_track_states = default.main_track_states
local static_track_top = default.static_track_top

local inspect_state = setmetatable({}, {__index = main_track_states.inspect})
local idle_state = setmetatable({}, {__index = main_track_states.idle})

-- ============================================================================
-- КЛИЕНТСКОЕ ХРАНИЛИЩЕ СОСТОЯНИЯ МАГАЗИНА
-- ============================================================================
-- 0 - первое положение спарки, 1 - второе положение спарки
local CURRENT_MAG_FLIPPED = 0

-- ============================================================================
-- НАСТРОЙКА ЦЕВЬЕВ (СПИСОК МОДУЛЕЙ)
-- ============================================================================
local VALID_HANDGUARDS = {
    ["ra1k:handguard_green"]       = true,
    ["ra1k:handguard_green_laser"] = true,
    ["ra1k:handguard_red"]         = true,
    ["ra1k:handguard_red_laser"]   = true,
    ["ra1k:handguard_sand"]        = true,
    ["ra1k:handguard_sand_laser"]  = true,
    ["ra1k:handguard_grey"]        = true,
    ["ra1k:handguard_grey_laser"]  = true,
}

local function hasCustomHandguard(context)
    local laser = context:getAttachment("LASER")
    return not not (VALID_HANDGUARDS[laser])
end

-- Добавляем новую функцию проверки для tactical handguard
local function hasTacticalHandguard(context)
    return context:getAttachment("LASER") == "ra1k:handguard_tactical"
end

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
    return current_grip ~= "tacz:empty" and not GRIP_BLACKLIST[current_grip]
end

local function increment(obj)
    obj.value = obj.value + 1
    return obj.value - 1
end

-- Регистрируем новые треки анимаций
local FIRE_MODE_TRACK = increment(static_track_top)
local SWITCH_MODE_TRACK = increment(static_track_top)
local HANDGUARD_TRACK = increment(static_track_top) 
local MAG_STATE_TRACK = increment(static_track_top)
local LMG_TRACK = increment(static_track_top)

local function isNoAmmo(context)
    return (not context:hasBulletInBarrel()) and (context:getAmmoCount() <= 0)
end

-- Проверка на установленный спаренный магазин
local function hasFlipMag(context)
    return context:getAttachment("EXTENDED_MAG") == "ra1k:flip_mag"
end

local TARGET_MAG_POSITION = 0

local function runReloadAnimation(context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()

        if (isNoAmmo(context)) then
            if (ext == 0) then
                context:runAnimation("reload", track, false, PLAY_ONCE_STOP, 0.2)
            else
                context:runAnimation("reload", track, false, PLAY_ONCE_STOP, 0.2)
            end
        else
            if (ext == 0) then
                context:runAnimation("reload", track, false, PLAY_ONCE_STOP, 0.2)
            else
                context:runAnimation("reload", track, false, PLAY_ONCE_STOP, 0.2)
            end
        end
end

local function runInspectAnimation(context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
        if (isNoAmmo(context)) then
            context:runAnimation("inspect", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("inspect", track, false, PLAY_ONCE_STOP, 0.2)
        end
end

function idle_state.transition(this, context, input)
    if (input == INPUT_RELOAD) then
        runReloadAnimation(context)
        return this.main_track_states.idle
    end
    if (input == INPUT_PUT_AWAY) then
        local put_away_time = context:getPutAwayTime()
        local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
        local ugl = context:getAttachment("GRIP")
		if (ugl == "ra1k:gp25" or ugl == "ra1k:m203") and context:getFireMode() == AUTO then 
			context:runAnimation("put_away_1222222", track, false, PLAY_ONCE_HOLD, put_away_time * 0.1)
		else
			context:runAnimation("put_away", track, false, PLAY_ONCE_HOLD, put_away_time * 0.75)
		end
        context:setAnimationProgress(track, 1, true)
        context:adjustAnimationProgress(track, -put_away_time, false)
        return this.main_track_states.final
    end
    if (input == INPUT_INSPECT) then
        runInspectAnimation(context)
        return inspect_state
    end
    return main_track_states.idle.transition(this, context, input)
end

-- СТРУКТУРА ПЕРЕВОДЧИКА ОГНЯ
local fire_mode_state = { semi = {}, auto = {}, draw = {} }
function fire_mode_state.draw.update(this, context) context:trigger(this.INPUT_MODE_DRAW) end
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
function fire_mode_state.semi.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK)
    if (context:isHolding(track)) then context:runAnimation("static_semi", track, true, PLAY_ONCE_HOLD, 0) end
    if (context:getFireMode() == AUTO) then context:trigger(this.INPUT_MODE_AUTO) end
end
function fire_mode_state.semi.transition(this, context,input)
    if(input == this.INPUT_MODE_AUTO)then
        context:runAnimation("switch_auto", context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK), false, PLAY_ONCE_STOP, 0)
        return fire_mode_state.auto
    end
    if(input == INPUT_SHOOT or input == INPUT_RELOAD or input == INPUT_INSPECT)then context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK)) end
end
function fire_mode_state.auto.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK)
    if (context:isHolding(track)) then context:runAnimation("static_auto", track, true, PLAY_ONCE_HOLD, 0) end
    if (context:getFireMode() == SEMI) then context:trigger(this.INPUT_MODE_SEMI) end
end
function fire_mode_state.auto.transition(this, context,input)
    if(input == this.INPUT_MODE_SEMI)then
        context:runAnimation("switch_semi", context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK), false, PLAY_ONCE_STOP, 0)
        return fire_mode_state.semi
    end
    if(input == INPUT_SHOOT or input == INPUT_RELOAD or input == INPUT_INSPECT)then context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK)) end
end

-- СТРУКТУРА ЦЕВЬЯ
local handguard_state = { state_true = {}, state_tactical = {}, state_false = {}, draw = {} }

function handguard_state.draw.update(this, context) 
    context:trigger("INPUT_HG_DRAW") 
end

function handguard_state.draw.transition(this, context, input)
    if (input == "INPUT_HG_DRAW") then
        local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
        if (hasTacticalHandguard(context)) then
            context:runAnimation("hg_tactical_true", track, true, PLAY_ONCE_HOLD, 0)
            return handguard_state.state_tactical
        elseif (hasCustomHandguard(context)) then
            context:runAnimation("handguard_true", track, true, PLAY_ONCE_HOLD, 0)
            return handguard_state.state_true
        else
            context:runAnimation("handguard_false", track, true, PLAY_ONCE_HOLD, 0)
            return handguard_state.state_false
        end
    end
end

-- Состояние: Стандартный Custom Handguard
function handguard_state.state_true.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
    if (context:isHolding(track)) then context:runAnimation("handguard_true", track, true, PLAY_ONCE_HOLD, 0) end
    
    if (hasTacticalHandguard(context)) then 
        context:trigger("INPUT_HG_TACTICAL")
    elseif (not hasCustomHandguard(context)) then 
        context:trigger("INPUT_HG_FALSE") 
    end
end

function handguard_state.state_true.transition(this, context, input)
    local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
    if (input == "INPUT_HG_TACTICAL") then
        context:runAnimation("hg_tactical_true", track, true, PLAY_ONCE_HOLD, 0)
        return handguard_state.state_tactical
    elseif (input == "INPUT_HG_FALSE") then
        context:runAnimation("handguard_false", track, true, PLAY_ONCE_HOLD, 0)
        return handguard_state.state_false
    end
end

-- Состояние: Tactical Handguard
function handguard_state.state_tactical.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
    if (context:isHolding(track)) then context:runAnimation("hg_tactical_true", track, true, PLAY_ONCE_HOLD, 0) end
    
    if (hasCustomHandguard(context) and not hasTacticalHandguard(context)) then 
        context:trigger("INPUT_HG_TRUE")
    elseif (not hasTacticalHandguard(context)) then 
        context:trigger("INPUT_HG_FALSE") 
    end
end

function handguard_state.state_tactical.transition(this, context, input)
    local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
    if (input == "INPUT_HG_TRUE") then
        context:runAnimation("handguard_true", track, true, PLAY_ONCE_HOLD, 0)
        return handguard_state.state_true
    elseif (input == "INPUT_HG_FALSE") then
        context:runAnimation("handguard_false", track, true, PLAY_ONCE_HOLD, 0)
        return handguard_state.state_false
    end
end

-- Состояние: Стандартное цевье (False)
function handguard_state.state_false.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
    if (context:isHolding(track)) then context:runAnimation("handguard_false", track, true, PLAY_ONCE_HOLD, 0) end
    
    if (hasTacticalHandguard(context)) then 
        context:trigger("INPUT_HG_TACTICAL")
    elseif (hasCustomHandguard(context)) then 
        context:trigger("INPUT_HG_TRUE") 
    end
end

function handguard_state.state_false.transition(this, context, input)
    local track = context:getTrack(STATIC_TRACK_LINE, HANDGUARD_TRACK)
    if (input == "INPUT_HG_TACTICAL") then
        context:runAnimation("hg_tactical_true", track, true, PLAY_ONCE_HOLD, 0)
        return handguard_state.state_tactical
    elseif (input == "INPUT_HG_TRUE") then
        context:runAnimation("handguard_true", track, true, PLAY_ONCE_HOLD, 0)
        return handguard_state.state_true
    end
end



-- ============================================================================
-- СТРУКТУРА СПАРЕННОГО МАГАЗИНА (РЕАКТИВНАЯ)
-- ============================================================================
local dual_mag_state = { state_false = {}, flip_1 = {}, flip_2 = {}, draw = {} }

function dual_mag_state.draw.update(this, context) 
    context:trigger("INPUT_MAG_DRAW") 
end

function dual_mag_state.draw.transition(this, context, input)
    if (input == "INPUT_MAG_DRAW") then
        local track = context:getTrack(STATIC_TRACK_LINE, MAG_STATE_TRACK)
        if not hasFlipMag(context) then
            context:runAnimation("mag_false", track, true, PLAY_ONCE_HOLD, 0)
            return dual_mag_state.state_false
        else
            if CURRENT_MAG_FLIPPED == 0 then
                context:runAnimation("non", track, true, PLAY_ONCE_HOLD, 0)
                return dual_mag_state.flip_1
            else
                context:runAnimation("mag_true", track, true, PLAY_ONCE_HOLD, 0)
                return dual_mag_state.flip_2
            end
        end
    end
end

function dual_mag_state.state_false.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAG_STATE_TRACK)
    if (context:isHolding(track)) then context:runAnimation("mag_false", track, true, PLAY_ONCE_HOLD, 0) end
    if hasFlipMag(context) then context:trigger("INPUT_MAG_CHECK") end
end

function dual_mag_state.state_false.transition(this, context, input)
    if (input == "INPUT_MAG_CHECK") then
        local track = context:getTrack(STATIC_TRACK_LINE, MAG_STATE_TRACK)
        if CURRENT_MAG_FLIPPED == 0 then
            context:runAnimation("mag_true", track, true, PLAY_ONCE_HOLD, 0)
            return dual_mag_state.flip_1
        else
            context:runAnimation("mag_true", track, true, PLAY_ONCE_HOLD, 0)
            return dual_mag_state.flip_2
        end
    end
end

-- Состояние: Положение 1
function dual_mag_state.flip_1.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAG_STATE_TRACK)
    local reloadState = context:getReloadStateType()

    -- Если идет ЛЮБАЯ перезарядка, железно держим безопасную нулевую позу mag_flip_1
    if reloadState ~= 0 and reloadState ~= "NOT_RELOADING" then
        context:runAnimation("non", track, true, PLAY_ONCE_HOLD, 0)
        if not hasFlipMag(context) then context:trigger("INPUT_MAG_FALSE") end
        return
    end

    -- Перезарядка закончилась (в покое) -> Проверяем, нужно ли сменить стейт на положение 2
    if TARGET_MAG_POSITION == 2 then
        TARGET_MAG_POSITION = 0 -- сбрасываем флаг направления
        CURRENT_MAG_FLIPPED = 1
        context:trigger("INPUT_MAG_FLIP_TO_2")
        return
    end

    -- Обычное удержание в покое
    if (context:isHolding(track)) then 
        context:runAnimation("non", track, true, PLAY_ONCE_HOLD, 0) 
    end

    if not hasFlipMag(context) then context:trigger("INPUT_MAG_FALSE") end
end

function dual_mag_state.flip_1.transition(this, context, input)
    if (input == "INPUT_MAG_FLIP_TO_2") then
        local track = context:getTrack(STATIC_TRACK_LINE, MAG_STATE_TRACK)
        -- Включаем mag_flip_2 без задержек (0), так как перезарядка уже закончилась
        context:runAnimation("non", track, true, PLAY_ONCE_HOLD, 0)
        return dual_mag_state.flip_2
    end
    if (input == "INPUT_MAG_FALSE") then
        local track = context:getTrack(STATIC_TRACK_LINE, MAG_STATE_TRACK)
        context:runAnimation("mag_false", track, true, PLAY_ONCE_HOLD, 0)
        return dual_mag_state.state_false
    end
end

-- Состояние: Положение 2
function dual_mag_state.flip_2.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAG_STATE_TRACK)
    local reloadState = context:getReloadStateType()

    -- Если идет ЛЮБАЯ перезарядка, временно переключаем фон на нулевой mag_flip_1,
    -- чтобы кости в Blockbench для reload_flip_2 не выкручивались дважды!
    if reloadState ~= 0 and reloadState ~= "NOT_RELOADING" then
        context:runAnimation("non", track, true, PLAY_ONCE_HOLD, 0)
        if not hasFlipMag(context) then context:trigger("INPUT_MAG_FALSE") end
        return
    end

    -- Перезарядка закончилась (в покое) -> Проверяем, нужно ли сменить стейт на положение 1
    if TARGET_MAG_POSITION == 1 then
        TARGET_MAG_POSITION = 0 -- сбрасываем флаг направления
        CURRENT_MAG_FLIPPED = 0
        context:trigger("INPUT_MAG_FLIP_TO_1")
        return
    end

    -- В обычном покое — держим родную позу 2
    if (context:isHolding(track)) then 
        context:runAnimation("non", track, true, PLAY_ONCE_HOLD, 0) 
    end

    if not hasFlipMag(context) then context:trigger("INPUT_MAG_FALSE") end
end

function dual_mag_state.flip_2.transition(this, context, input)
    if (input == "INPUT_MAG_FLIP_TO_1") then
        local track = context:getTrack(STATIC_TRACK_LINE, MAG_STATE_TRACK)
        context:runAnimation("non", track, true, PLAY_ONCE_HOLD, 0)
        return dual_mag_state.flip_1
    end
    if (input == "INPUT_MAG_FALSE") then
        local track = context:getTrack(STATIC_TRACK_LINE, MAG_STATE_TRACK)
        context:runAnimation("mag_false", track, true, PLAY_ONCE_HOLD, 0)
        return dual_mag_state.state_false
    end
end
-- ============================================================================

function inspect_state.transition(this, context, input)
    if (input == INPUT_FIRE_SELECT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))
        return this.main_track_states.idle
    end
    return main_track_states.inspect.transition(this, context, input)
end

local M = setmetatable({
    main_track_states = setmetatable({ idle = idle_state, inspect = inspect_state }, {__index = main_track_states}),
    FIRE_MODE_TRACK = FIRE_MODE_TRACK,
    GRIP_BLACKLIST = GRIP_BLACKLIST,
    HANDGUARD_TRACK = HANDGUARD_TRACK,
    MAG_STATE_TRACK = MAG_STATE_TRACK, 
    LMG_TRACK = LMG_TRACK,
    SWITCH_MODE_TRACK = SWITCH_MODE_TRACK,
    INPUT_MODE_SEMI = "input_mode_semi",
    INPUT_MODE_BURST = "input_mode_burst",
    INPUT_MODE_AUTO = "input_mode_auto",
    INPUT_MODE_DRAW = "input_mode_draw",
    fire_mode_state = fire_mode_state,
    handguard_state = handguard_state,
    lmg_state = lmg_state,
    dual_mag_state = dual_mag_state 
}, {__index = default})

function M:initialize(context) default.initialize(self, context) end
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
        self.handguard_state.draw,
        self.dual_mag_state.draw 
    }
end

return M