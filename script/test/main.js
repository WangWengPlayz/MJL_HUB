local Rayfield = loadstring(game:HttpGet('https://sirius.menu/rayfield'))()

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local VirtualUser = game:GetService("VirtualUser")

local LocalPlayer = Players.LocalPlayer

local VERSION = "v1.0.6 - Dungeon"
local TITLE = "Dungeon Auto Farmer | " .. VERSION

local DUNGEON_GAME_ID = 140070560575882

if game.PlaceId ~= DUNGEON_GAME_ID then
    Rayfield:Notify({
        Title = "Wrong Game",
        Content = "This script is for the Dungeon game only!",
        Duration = 5,
        Image = "circle-x",
    })
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

local Window = Rayfield:CreateWindow({
    Name = TITLE,
    LoadingTitle = "Initializing...",
    LoadingSubtitle = "by MJL",
    ShowText = "Open Menu",
    ToggleUIKeybind = "K",
    ConfigurationSaving = {
        Enabled = true,
        FolderName = "MJL_Scripts",
        FileName = "MJL_Dungeon",
    }
})

local DungeonTab = Window:CreateTab("Auto Dungeon", nil)
local CreditsTab = Window:CreateTab("Credits", nil)

Rayfield:Notify({
    Title = "Disclaimer",
    Content = "By using this script, you agree that MJL is NOT responsible for any account bans. Use at your own risk.",
    Duration = 8,
    Image = "triangle-alert",
})

local dungeonEnabled = false
local dungeonClickDelay = 0.05

DungeonTab:CreateSection("Auto Dungeon")
DungeonTab:CreateParagraph({
    Title = "Dungeon Active",
    Content = "You are in the Dungeon game! Anti AFK is running silently.",
})

DungeonTab:CreateSlider({
    Name = "Auto Click Speed",
    Range = {0.01, 0.5},
    Increment = 0.01,
    Suffix = "s",
    CurrentValue = 0.05,
    Flag = "DungeonClickSpeed",
    Callback = function(Value)
        dungeonClickDelay = Value
    end,
})

-- Safe getconnections wrapper
local safeGetConnections = function(signal)
    local ok, result = pcall(function()
        if getconnections then
            return getconnections(signal)
        end
        return {}
    end)
    return (ok and result) or {}
end

-- Helper: fire all connections on a GuiButton signal
local function fireButtonConnections(button, eventName)
    pcall(function()
        local conns = safeGetConnections(button[eventName])
        for _, connection in ipairs(conns) do
            pcall(function() connection:Fire() end)
        end
    end)
end

-- Helper: clean up physics constraints from HRP
local function cleanupFlight(hrp)
    if not hrp then return end
    local names = {"FlyVelocity", "FlyGyro", "FlyAttachment"}
    for _, name in ipairs(names) do
        local child = hrp:FindFirstChild(name)
        if child then
            pcall(function() child:Destroy() end)
        end
    end
end

-- Auto Pick Cards loop
local function startAutoPickLoop(sessionActive)
    task.spawn(function()
        while dungeonEnabled and sessionActive() do
            task.wait(0.5)
            pcall(function()
                local playerGui = LocalPlayer:FindFirstChild("PlayerGui")
                if not playerGui then return end

                local dungeonGui = playerGui:FindFirstChild("DungeonCardsGui")
                if not dungeonGui or not dungeonGui.Enabled then return end

                local dimFrame = dungeonGui:FindFirstChild("Dim")
                if not dimFrame or not dimFrame.Visible then return end

                local autoPickButton = dimFrame:FindFirstChild("AutoPick")
                if not autoPickButton or not autoPickButton.Visible then return end

                local events = {"Activated", "MouseButton1Click", "MouseButton1Down", "TouchTap"}
                for _, eventName in ipairs(events) do
                    fireButtonConnections(autoPickButton, eventName)
                end
            end)
        end
    end)
end

-- Magic power + teleport + position lock loop
local function startDungeonLoop(sessionActive)
    task.spawn(function()
        local Remotes = ReplicatedStorage:FindFirstChild("Remotes")
        local MagicEvent = Remotes and Remotes:FindFirstChild("GainMagicPower")
        local targetPosition = Vector3.new(-334, 45, 266)

        -- Magic power firing loop
        if MagicEvent then
            task.spawn(function()
                while dungeonEnabled and sessionActive() do
                    pcall(function()
                        MagicEvent:FireServer()
                    end)
                    task.wait(dungeonClickDelay)
                end
            end)
        end

        -- Position lock loop
        task.spawn(function()
            local flightSetup = false

            while dungeonEnabled and sessionActive() do
                pcall(function()
                    local character = LocalPlayer.Character
                    if not character then return end

                    local hrp = character:FindFirstChild("HumanoidRootPart")
                    local humanoid = character:FindFirstChild("Humanoid")

                    if not hrp or not humanoid or humanoid.Health <= 0 then
                        flightSetup = false
                        cleanupFlight(hrp)
                        return
                    end

                    hrp.CFrame = CFrame.new(targetPosition)

                    if not flightSetup then
                        cleanupFlight(hrp)

                        local attachment = Instance.new("Attachment")
                        attachment.Name = "FlyAttachment"
                        attachment.Parent = hrp

                        local linearVel = Instance.new("LinearVelocity")
                        linearVel.Name = "FlyVelocity"
                        linearVel.Attachment0 = attachment
                        linearVel.VectorVelocity = Vector3.new(0, 0, 0)
                        linearVel.MaxForce = 400000
                        linearVel.Parent = hrp

                        local alignOrient = Instance.new("AlignOrientation")
                        alignOrient.Name = "FlyGyro"
                        alignOrient.Attachment0 = attachment
                        alignOrient.CFrame = hrp.CFrame
                        alignOrient.MaxTorque = 400000
                        alignOrient.Responsiveness = 200
                        alignOrient.Parent = hrp

                        flightSetup = true
                    end
                end)

                task.wait(0.5)
            end

            -- Cleanup on stop
            pcall(function()
                local character = LocalPlayer.Character
                if not character then return end
                local hrp = character:FindFirstChild("HumanoidRootPart")
                cleanupFlight(hrp)
                local humanoid = character:FindFirstChild("Humanoid")
                if humanoid then
                    humanoid:ChangeState(Enum.HumanoidStateType.GettingUp)
                end
            end)
        end)
    end)
end

DungeonTab:CreateToggle({
    Name = "Auto Dungeon",
    CurrentValue = false,
    Flag = "DungeonToggle",
    Callback = function(Value)
        dungeonEnabled = Value

        if dungeonEnabled then
            Rayfield:Notify({
                Title = "Auto Pick Cards",
                Content = "Auto Pick will start clicking automatically!",
                Duration = 4,
                Image = "square-stack",
            })

            local function sessionActive()
                return dungeonEnabled
            end

            startAutoPickLoop(sessionActive)
            startDungeonLoop(sessionActive)
        else
            pcall(function()
                local character = LocalPlayer.Character
                if not character then return end
                local hrp = character:FindFirstChild("HumanoidRootPart")
                cleanupFlight(hrp)
                local humanoid = character:FindFirstChild("Humanoid")
                if humanoid then
                    humanoid:ChangeState(Enum.HumanoidStateType.GettingUp)
                end
            end)
        end
    end,
})

CreditsTab:CreateSection("Credits")
CreditsTab:CreateParagraph({
    Title = "Developer",
    Content = "Made by MJL",
})
CreditsTab:CreateParagraph({
    Title = "Libraries Used",
    Content = "Rayfield UI Library by Sirius",
})

pcall(function()
    Rayfield:LoadConfiguration()
end)