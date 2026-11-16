local M = {}

function M.shoot(api)	
    api:safeAsyncTask(function ()
		api:shootOnce()
        return false
    end,1*8000,0,1)
end


function M.tick_heat(api, heatTimestamp)

	api:putAmmoInMagazine(322)  


end


return M