-- +1 Magic Evolution Auto Farmer | v2.0.0
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

local Players            = game:GetService("Players")
local ReplicatedStorage  = game:GetService("ReplicatedStorage")
local MarketplaceService = game:GetService("MarketplaceService")
local VirtualUser        = game:GetService("VirtualUser")

local LocalPlayer = Players.LocalPlayer
local VERSION     = "v2.0.0"

local gameName = "+1 Magic Evolution"
local ok, info = pcall(function() return MarketplaceService:GetProductInfo(game.PlaceId) end)
if ok and info and info.Name then gameName = info.Name end
local TITLE = gameName .. " | " .. VERSION

-- Dungeon auto-load
local DUNGEON_GAME_ID   = "140070560575882"
local DUNGEON_SCRIPT_URL = "https://mjl-hub.vercel.app/script/%2B1%20Magic%20Evolution/sp1.js"

if tostring(game.PlaceId) == DUNGEON_GAME_ID then
    pcall(function()
        loadstring(game:HttpGet(DUNGEON_SCRIPT_URL))()
    end)
    return
end

-- Variables
local currentRebirths  = 0
local toggleEnabled    = false
local loopDelay        = 2
local autoClickEnabled = false
local clickSpeed       = 5
local clickDelay       = 0.1
local rebirthEnabled   = false
local rebirthScale     = 20
local rebirthWaitTime  = 5
local afkEnabled       = false

local powerZones = {
    ["1x Power (0 Rebirths)"]    = { pos = Vector3.new(22,  5, -32),  rebirths = 0  },
    ["2x Power (1 Rebirth)"]     = { pos = Vector3.new(7,   5, -34),  rebirths = 1  },
    ["5x Power (3 Rebirths)"]    = { pos = Vector3.new(-19, 5, -38),  rebirths = 3  },
    ["10x Power (5 Rebirths)"]   = { pos = Vector3.new(34,  5, -61),  rebirths = 5  },
    ["50x Power (15 Rebirths)"]  = { pos = Vector3.new(10,  5, -60),  rebirths = 15 },
    ["100x Power (45 Rebirths)"] = { pos = Vector3.new(-6,  5, -61),  rebirths = 45 },
    ["200x Power (60 Rebirths)"] = { pos = Vector3.new(-4,  6, -189), rebirths = 60 },
}

local ZONE_ORDER = {
    "1x Power (0 Rebirths)",
    "2x Power (1 Rebirth)",
    "5x Power (3 Rebirths)",
    "10x Power (5 Rebirths)",
    "50x Power (15 Rebirths)",
    "100x Power (45 Rebirths)",
    "200x Power (60 Rebirths)",
}

local selectedPowerZone = powerZones["1x Power (0 Rebirths)"]
local afkPosition       = powerZones["1x Power (0 Rebirths)"].pos

-- Anti-AFK
task.spawn(function()
    while true do
        task.wait(55)
        pcall(function()
            VirtualUser:CaptureController()
            VirtualUser:ClickButton2(Vector2.new())
        end)
    end
end)

-- Utility
local function getClickDelay(speed)
    return math.max(0.02, 0.5 / speed)
end

local function waitForCharacter()
    local character = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()
    local hrp       = character:WaitForChild("HumanoidRootPart", 10)
    local humanoid  = character:WaitForChild("Humanoid", 10)
    if not hrp or not humanoid then return nil, nil, nil end
    local timeout = 0
    repeat
        task.wait(0.1)
        timeout = timeout + 0.1
    until humanoid.FloorMaterial ~= Enum.Material.Air or timeout >= 3
    return character, hrp, humanoid
end

local function triggerPosition(hrp, _humanoid, cx, cy, cz)
    if not hrp or not hrp.Parent then return false end
    hrp.CFrame = CFrame.new(cx, cy, cz)
    task.wait(0.25)
    return true
end

local function doWinCycle(hrp, humanoid)
    for _ = 1, 2 do
        if not hrp or not hrp.Parent then return false end
        if not triggerPosition(hrp, humanoid, 3568, 7, 9) then return false end
        task.wait(0.15)
    end
    return true
end

local function getRemote(name)
    local Remotes = ReplicatedStorage:FindFirstChild("Remotes")
    return Remotes and Remotes:FindFirstChild(name)
end

-- Window
local Window = Rayfield:CreateWindow({
    Name = TITLE,
    LoadingTitle = "Initializing...",
    LoadingSubtitle = "by MJL",
    ToggleUIKeybind = "K",
    DisableBuildWarnings = true,
    ConfigurationSaving = {
        Enabled = true,
        FolderName = "MJL_Scripts",
        FileName = "MJL_Evolution",
    },
    Discord = { Enabled = false },
    KeySystem = false,
})

local MainTab     = Window:CreateTab("🌾 Auto Farm",  nil)
local DungeonTab  = Window:CreateTab("⚔️ Dungeon",    nil)
local SettingsTab = Window:CreateTab("⚙️ Settings",   nil)
local CreditsTab  = Window:CreateTab("🌐 Credits",    nil)

-- Rebirth Counter
MainTab:CreateSection("📊 Rebirth Information")
local liveCounterLabel = MainTab:CreateLabel("Current Rebirths: 0")
local statusLabel      = MainTab:CreateLabel("Status: Idle")

task.spawn(function()
    pcall(function()
        local playerGui    = LocalPlayer:WaitForChild("PlayerGui", 15)
        local rebirthLabel = playerGui
            :WaitForChild("GUI")
            :WaitForChild("HUD")
            :WaitForChild("Labels")
            :WaitForChild("RebirthLabel")

        local function updateCount()
            local numericString = string.gsub(rebirthLabel.Text, "%D", "")
            currentRebirths = tonumber(numericString) or 0
            liveCounterLabel:Set("Current Rebirths: " .. currentRebirths)
        end

        rebirthLabel:GetPropertyChangedSignal("Text"):Connect(updateCount)
        updateCount()
    end)
end)

-- Infinite Wins
MainTab:CreateSection("🏆 Infinite Wins")
MainTab:CreateSlider({
    Name = "⏱️ Loop Delay (Seconds)",
    Range = {2, 5},
    Increment = 0.5,
    Suffix = "s",
    CurrentValue = 2,
    Callback = function(Value)
        loopDelay = Value
    end,
})

MainTab:CreateToggle({
    Name = "🏆 Infinite Wins",
    CurrentValue = false,
    Callback = function(Value)
        toggleEnabled = Value
        if toggleEnabled then
            statusLabel:Set("Status: Infinite Wins - ACTIVE")
            task.spawn(function()
                while toggleEnabled do
                    local _, hrp = waitForCharacter()
                    if hrp then
                        triggerPosition(hrp, nil, 3568, 7, 9)
                    end
                    task.wait(loopDelay)
                end
                statusLabel:Set("Status: Idle")
            end)
        else
            statusLabel:Set("Status: Idle")
        end
    end,
})

-- Auto Click
MainTab:CreateSection("🖱️ Auto Click")
MainTab:CreateSlider({
    Name = "⚡ Click Speed Multiplier",
    Range = {1, 20},
    Increment = 1,
    Suffix = "x",
    CurrentValue = 5,
    Callback = function(Value)
        clickSpeed = Value
        clickDelay = getClickDelay(Value)
    end,
})

MainTab:CreateToggle({
    Name = "🖱️ Auto Click",
    CurrentValue = false,
    Callback = function(Value)
        autoClickEnabled = Value
        if autoClickEnabled then
            statusLabel:Set("Status: Auto Click - ACTIVE")
            task.spawn(function()
                local Event = getRemote("GainMagicPower")
                while autoClickEnabled do
                    if Event then
                        pcall(function() Event:FireServer() end)
                    end
                    task.wait(clickDelay)
                end
                statusLabel:Set("Status: Idle")
            end)
        else
            statusLabel:Set("Status: Idle")
        end
    end,
})

-- Auto Rebirth
MainTab:CreateSection("🔄 Auto Farm Rebirth")
MainTab:CreateSlider({
    Name = "📈 Rebirth Scale (Wait Time)",
    Range = {20, 100},
    Increment = 5,
    Suffix = "s",
    CurrentValue = 20,
    Callback = function(Value)
        rebirthScale = Value
    end,
})

MainTab:CreateSlider({
    Name = "⏳ Wait Before Next Loop",
    Range = {1, 15},
    Increment = 1,
    Suffix = "s",
    CurrentValue = 5,
    Callback = function(Value)
        rebirthWaitTime = Value
    end,
})

MainTab:CreateDropdown({
    Name = "🌍 Select Farm Zone",
    Options = ZONE_ORDER,
    CurrentOption = {"1x Power (0 Rebirths)"},
    Callback = function(Value)
        local picked = type(Value) == "table" and Value[1] or Value
        selectedPowerZone = powerZones[picked]
        statusLabel:Set("Status: Zone → " .. picked)
    end,
})

MainTab:CreateToggle({
    Name = "🔄 Auto Farm Rebirth",
    CurrentValue = false,
    Callback = function(Value)
        rebirthEnabled = Value
        if rebirthEnabled then
            statusLabel:Set("Status: Auto Rebirth - ACTIVE")
            task.spawn(function()
                local RebirthEvent = getRemote("Rebirth")
                while rebirthEnabled do
                    pcall(function()
                        local _, hrp, humanoid = waitForCharacter()
                        if hrp and selectedPowerZone then
                            doWinCycle(hrp, humanoid)
                            task.wait(0.5)
                            triggerPosition(hrp, humanoid, -75, 6, 45)
                            task.wait(0.5)
                            triggerPosition(hrp, humanoid,
                                selectedPowerZone.pos.X,
                                selectedPowerZone.pos.Y,
                                selectedPowerZone.pos.Z)
                            task.wait(rebirthScale)
                            if RebirthEvent then
                                RebirthEvent:FireServer()
                            end
                            task.wait(rebirthWaitTime)
                        end
                    end)
                    task.wait(1)
                end
                statusLabel:Set("Status: Idle")
            end)
        else
            statusLabel:Set("Status: Idle")
        end
    end,
})

-- AFK Mode
MainTab:CreateSection("😴 AFK Mode")
MainTab:CreateDropdown({
    Name = "📍 Select AFK Zone",
    Options = ZONE_ORDER,
    CurrentOption = {"1x Power (0 Rebirths)"},
    Callback = function(Value)
        local picked = type(Value) == "table" and Value[1] or Value
        if powerZones[picked] then
            afkPosition = powerZones[picked].pos
            statusLabel:Set("Status: AFK Zone → " .. picked)
        end
    end,
})

MainTab:CreateToggle({
    Name = "😴 AFK Mode",
    CurrentValue = false,
    Callback = function(Value)
        afkEnabled = Value
        if afkEnabled then
            statusLabel:Set("Status: AFK Mode - ACTIVE")
            task.spawn(function()
                while afkEnabled do
                    local _, hrp = waitForCharacter()
                    if hrp then
                        hrp.CFrame = CFrame.new(afkPosition)
                    end
                    task.wait(2)
                end
                statusLabel:Set("Status: Idle")
            end)
        else
            statusLabel:Set("Status: Idle")
        end
    end,
})

-- Dungeon Tab
DungeonTab:CreateSection("⚔️ Dungeon")
DungeonTab:CreateParagraph({
    Title = "🏰 Dungeon Auto-Load",
    Content = "When you enter the dungeon, the script automatically detects it and loads the dungeon script. No manual switching needed.",
})

-- Settings Tab
SettingsTab:CreateSection("⚙️ Settings")
SettingsTab:CreateButton({
    Name = "🛑 Disable All Features",
    Callback = function()
        toggleEnabled    = false
        autoClickEnabled = false
        rebirthEnabled   = false
        afkEnabled       = false
        statusLabel:Set("Status: All Features Disabled")
    end,
})

-- Credits Tab
CreditsTab:CreateSection("🌐 Credits")
CreditsTab:CreateParagraph({ Title = "👨‍💻 Developer", Content = "Made by MJL" })
CreditsTab:CreateParagraph({ Title = "📌 Version",    Content = VERSION })

pcall(function() Rayfield:LoadConfiguration() end)

statusLabel:Set("Status: Script Ready")