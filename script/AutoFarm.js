-- @tags: farm, automation
-- AutoFarm - example script served by MJL HUB
local RunService = game:GetService("RunService")

local farming = true
RunService.Heartbeat:Connect(function()
    if farming then
        -- farming logic goes here
    end
end)

print("AutoFarm started.")
