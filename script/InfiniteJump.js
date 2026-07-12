-- @tags: movement, fun
-- InfiniteJump - example script served by MJL HUB
local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")
local player = Players.LocalPlayer

UserInputService.JumpRequest:Connect(function()
    local humanoid = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
    if humanoid then
        humanoid:ChangeState("Jumping")
    end
end)

print("InfiniteJump enabled.")
