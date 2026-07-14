-- Dungeon Auto Farmer | v2.0.0
-- by MJL

if not game:IsLoaded() then
    game.Loaded:Wait()
end
task.wait(1)

-- Load Rayfield with fallback URLs
local Rayfield
local RAYFIELD_URLS = {
    "https://sirius.menu/rayfield",
    "https://raw.githubusercontent.com/sirius-menu/rayfield/refs/heads/main/source.lua",
    "https://raw.githubusercontent.com/SiriusSoftwareLtd/Rayfield/main/source.lua",
}

for _, url in ipairs(RAYFIELD_URLS) do
    local success, result = pcall(function()
        return loadstring(game:HttpGet(url, true))()
    end)
    if success and result then
        Rayfield = result
        break
    end
end

if not Rayfield then
    warn("Rayfield failed to load. Check your executor's HTTP settings.")
    return
end

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local VirtualUser       = game:GetService("VirtualUser")

local LocalPlayer     = Players.LocalPlayer
local VERSION         = "v2.0.0"
local TITLE           = "Dungeon Auto Farmer | " .. VERSION
local DUNGEON_GAME_ID = 140070560575882

if game.PlaceId ~= DUNGEON_GAME_ID then
    pcall(function()
        Rayfield:Notify({
            Title = "❌ Wrong Game",
            Content = "This script is for Dungeon only!\nYour PlaceId: " .. game.PlaceId,
            Duration = 8,
            Image = "circle-x",
        })
    end)
    return
end

-- Anti-AFK
task.spawn(function()
    while true do
        task.wait(60)
        pcall(function()
            VirtualUser:CaptureController()
            VirtualUser:ClickButton2(Vector2.new())
        end)
    end
end)

-- Window
local Window
local ok, err = pcall(function()
    Window = Rayfield:CreateWindow({
        Name = TITLE,
        LoadingTitle = "Initializing...",
        LoadingSubtitle = "by MJL",
        ShowText = "🎮 Open Menu",
        Icon = 0,
        Theme = "Default",
        ToggleUIKeybind = "K",
        DisableBuildWarnings = true,
        ConfigurationSaving = {
            Enabled = true,
            FolderName = "MJL_Scripts",
            FileName = "MJL_Dungeon",
        },
        Discord = { Enabled = false },
        KeySystem = false,
    })
end)

if not ok then
    warn("Failed to create Rayfield window: " .. tostring(err))
    return
end

local DungeonTab = Window:CreateTab("⚔️ Auto Dungeon", nil)
local CreditsTab = Window:CreateTab("🌐 Credits", nil)

pcall(function()
    Rayfield:Notify({
        Title = "⚠️ Disclaimer",
        Content = "MJL is NOT responsible for bans. Use at your own risk.",
        Duration = 8,
        Image = "triangle-alert",
    })
end)

local dungeonEnabled    = false
local dungeonClickDelay = 0.05

pcall(function()
    DungeonTab:CreateSection("⚔️ Auto Dungeon")
    DungeonTab:CreateParagraph({
        Title = "✅ Status",
        Content = "Dungeon verified! Anti-AFK running.\nPress K to toggle UI.",
    })
    DungeonTab:CreateSlider({
        Name = "⚡ Auto Click Speed",
        Range = {0.01, 0.5},
        Increment = 0.01,
        Suffix = "s",
        CurrentValue = 0.05,
        Flag = "DungeonClickSpeed",
        Callback = function(Value)
            dungeonClickDelay = Value
        end,
    })
end)

local function StartAutoPickCards()
    task.spawn(function()
        while dungeonEnabled do
            task.wait(0.5)
            pcall(function()
                local playerGui      = LocalPlayer:FindFirstChild("PlayerGui")
                if not playerGui then return end
                local dungeonGui     = playerGui:FindFirstChild("DungeonCardsGui")
                local dimFrame       = dungeonGui and dungeonGui:FindFirstChild("Dim")
                local autoPickButton = dimFrame and dimFrame:FindFirstChild("AutoPick")

                if autoPickButton and autoPickButton.Visible
                    and dimFrame.Visible and dungeonGui.Enabled then

                    if getconnections then
                        for _, eventName in ipairs({"Activated","MouseButton1Click","MouseButton1Down","TouchTap"}) do
                            pcall(function()
                                for _, c in ipairs(getconnections(autoPickButton[eventName])) do
                                    pcall(function() c:Fire() end)
                                end
                            end)
                        end
                    end

                    pcall(function()
                        if autoPickButton:IsA("GuiButton") then
                            autoPickButton:FireMouseButton1Click()
                        end
                    end)
                end
            end)
        end
    end)
end

local function StartMagicAndTeleport()
    task.spawn(function()
        local Remotes    = ReplicatedStorage:FindFirstChild("Remotes")
        local MagicEvent = Remotes and Remotes:FindFirstChild("GainMagicPower")
        local targetPos  = Vector3.new(-334, 45, 266)

        if MagicEvent then
            task.spawn(function()
                while dungeonEnabled do
                    pcall(function() MagicEvent:FireServer() end)
                    task.wait(dungeonClickDelay)
                end
            end)
        end

        task.spawn(function()
            local bodyVelocity, bodyGyro
            while dungeonEnabled do
                pcall(function()
                    local character = LocalPlayer.Character
                    if not character then return end
                    local hrp      = character:FindFirstChild("HumanoidRootPart")
                    local humanoid = character:FindFirstChild("Humanoid")
                    if not hrp or not humanoid or humanoid.Health <= 0 then return end

                    if hrp:FindFirstChild("FlyVelocity") then hrp.FlyVelocity:Destroy() end
                    if hrp:FindFirstChild("FlyGyro") then hrp.FlyGyro:Destroy() end

                    hrp.CFrame = CFrame.new(targetPos)

                    bodyVelocity = Instance.new("BodyVelocity")
                    bodyVelocity.Name = "FlyVelocity"
                    bodyVelocity.Velocity = Vector3.new(0, 0, 0)
                    bodyVelocity.MaxForce = Vector3.new(400000, 400000, 400000)
                    bodyVelocity.Parent = hrp

                    bodyGyro = Instance.new("BodyGyro")
                    bodyGyro.Name = "FlyGyro"
                    bodyGyro.CFrame = hrp.CFrame
                    bodyGyro.MaxTorque = Vector3.new(400000, 400000, 400000)
                    bodyGyro.Parent = hrp

                    task.spawn(function()
                        while dungeonEnabled and bodyVelocity.Parent do
                            pcall(function()
                                if humanoid.Health > 0 then
                                    bodyVelocity.Velocity = Vector3.new(0, 0, 0)
                                    bodyGyro.CFrame = hrp.CFrame
                                end
                            end)
                            task.wait(0.05)
                        end
                        pcall(function()
                            if bodyVelocity and bodyVelocity.Parent then bodyVelocity:Destroy() end
                            if bodyGyro and bodyGyro.Parent then bodyGyro:Destroy() end
                        end)
                    end)
                end)
                while dungeonEnabled do task.wait(1) end
            end

            pcall(function()
                if bodyVelocity and bodyVelocity.Parent then bodyVelocity:Destroy() end
                if bodyGyro and bodyGyro.Parent then bodyGyro:Destroy() end
            end)
        end)
    end)
end

local function StopDungeon()
    pcall(function()
        local character = LocalPlayer.Character
        if not character then return end
        local hrp      = character:FindFirstChild("HumanoidRootPart")
        local humanoid = character:FindFirstChild("Humanoid")
        if hrp then
            if hrp:FindFirstChild("FlyVelocity") then hrp.FlyVelocity:Destroy() end
            if hrp:FindFirstChild("FlyGyro") then hrp.FlyGyro:Destroy() end
        end
        if humanoid then
            humanoid:ChangeState(Enum.HumanoidStateType.GettingUp)
        end
    end)
end

pcall(function()
    DungeonTab:CreateToggle({
        Name = "⚔️ Auto Dungeon",
        CurrentValue = false,
        Flag = "DungeonToggle",
        Callback = function(Value)
            dungeonEnabled = Value
            if dungeonEnabled then
                pcall(function()
                    Rayfield:Notify({
                        Title = "🃏 Auto Pick Cards",
                        Content = "Auto Dungeon is now ACTIVE!",
                        Duration = 4,
                        Image = "square-stack",
                    })
                end)
                StartAutoPickCards()
                StartMagicAndTeleport()
            else
                StopDungeon()
                pcall(function()
                    Rayfield:Notify({
                        Title = "⏹ Stopped",
                        Content = "Auto Dungeon has been disabled.",
                        Duration = 3,
                        Image = "circle-stop",
                    })
                end)
            end
        end,
    })
end)

pcall(function()
    CreditsTab:CreateSection("🌐 Credits")
    CreditsTab:CreateParagraph({ Title = "👨‍💻 Developer", Content = "Made by MJL" })
    CreditsTab:CreateParagraph({ Title = "📚 Libraries", Content = "Rayfield UI by Sirius" })
    CreditsTab:CreateParagraph({ Title = "📌 Version", Content = VERSION })
end)

pcall(function() Rayfield:LoadConfiguration() end)