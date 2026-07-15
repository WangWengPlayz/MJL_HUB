loadstring(game:HttpGet("https://mjl-hub.vercel.app/script/MJLintroHub.js"))()
task.wait(5)

-- ==================== ANTI-AFK INITIALIZATION ====================
local VirtualUser = game:GetService("VirtualUser")
game:GetService("Players").LocalPlayer.Idled:Connect(function()
  VirtualUser:CaptureController()
  VirtualUser:ClickButton2(Vector2.new())
end)

-- ==================== GAME ID VALIDATION ====================
local ValidGames = {
  [115681808123944] = "Main Server",
  [72042130041700] = "World 2"
}

local CurrentPlaceId = game.PlaceId
local MarketplaceService = game:GetService("MarketplaceService")
local success, info = pcall(function() return MarketplaceService:GetProductInfo(CurrentPlaceId) end)
local CurrentGameName = success and info.Name or "Unknown Game"

if not ValidGames[CurrentPlaceId] then
  local ValidGameNames = table.concat(ValidGames, ", ")
  warn("[MJL HUB] INVALID GAME DETECTED!")
  game:GetService("StarterGui"):SetCore("SendNotification", {
      Title = "❌ Invalid Game",
      Text = "This script is only for: " .. ValidGameNames,
      Duration = 10,
      Icon = "rbxasset://textures/ui/GuiImagePlaceholder.png"
  })
  task.wait(3)
  game.Players.LocalPlayer:Kick("MJL HUB: Invalid Game.")
  return
end

-- ==================== LOAD RAYFIELD ====================
local Rayfield = loadstring(game:HttpGet("https://sirius.menu/rayfield"))()

-- ==================== CONFIGURATION ====================
local Config = {
  selectedCoin = "Chronos Coin",
  autoLandEnabled = false,
  autoSellEnabled = false,
  autoLuckEnabled = false,
  autoValueEnabled = false,
  luckUpgradeDelay = 1,
  valueUpgradeDelay = 1,
  antiAfkEnabled = false
}

local Coins = {
  "Basic Coin", "Copper Coin", "Fortune Coin", "Fire Coin", "Volt Coin",
  "Aether Coin", "Starlight Coin", "Galaxy Coin", "Void Coin", "Chronos Coin",
  "Eclipse Coin", "Mirage Coin", "Obsidian Coin", "Tempest Coin", "Soul Coin",
  "Paradox Coin", "Miracle Coin"
}

local CoinCoordinates = {
  -- Logic kept identical as requested
  ["Basic Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Copper Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Fortune Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Fire Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Volt Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Aether Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Starlight Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Galaxy Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Void Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Chronos Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Eclipse Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Mirage Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Obsidian Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Tempest Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Soul Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Paradox Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
  ["Miracle Coin"] = Vector3.new(-1160.78759765625, 0.7260000109672546, -160.92257690429688),
}

-- ==================== FUNCTIONS ====================
local function FireEvent(name, args)
  pcall(function()
      local event = game:GetService("ReplicatedStorage"):WaitForChild("Assets"):WaitForChild("Events"):WaitForChild(name)
      if args then event:FireServer(unpack(args)) else event:FireServer() end
  end)
end

-- Refactored loops to task.spawn
task.spawn(function()
  while true do
      if Config.autoLandEnabled then FireEvent("CoinLanded", {1.919, CoinCoordinates[Config.selectedCoin], Config.selectedCoin}) end
      if Config.autoSellEnabled then FireEvent("SellAll") end
      task.wait(Config.autoLandEnabled and 0.1 or 0.5)
  end
end)

task.spawn(function()
  while true do
      if Config.autoLuckEnabled then FireEvent("RequestUpgrade", {"Luck Multiplier"}) end
      if Config.autoValueEnabled then FireEvent("RequestUpgrade", {"Value Multiplier"}) end
      task.wait(math.max(Config.luckUpgradeDelay, Config.valueUpgradeDelay))
  end
end)

-- ==================== UI BUILDER ====================
local Window = Rayfield:CreateWindow({
  Name = "MJLHub | " .. CurrentGameName,
  LoadingTitle = "MJLHub v1.0.2",
  LoadingSubtitle = "by MJL - System Initializing...",
  ConfigurationSaving = { Enabled = true, FolderName = "MJL_HUB", FileName = "Config" },
  KeySystem = false
})

-- Main Tab
local MainTab = Window:CreateTab("🏠 Main", 4483362458)
MainTab:CreateSection("Farm Control")
MainTab:CreateDropdown({
  Name = "Select Target Coin",
  Options = Coins,
  CurrentOption = {"Chronos Coin"},
  Callback = function(Option) Config.selectedCoin = Option[1] end,
})
MainTab:CreateToggle({ Name = "Auto Land Coins", CurrentValue = false, Callback = function(V) Config.autoLandEnabled = V end })
MainTab:CreateToggle({ Name = "Auto Sell Items", CurrentValue = false, Callback = function(V) Config.autoSellEnabled = V end })

-- Upgrades Tab
local UpgradesTab = Window:CreateTab("⬆️ Upgrades", 12591620)
UpgradesTab:CreateSection("Multiplier Automation")
UpgradesTab:CreateToggle({ Name = "Auto Luck Multiplier", CurrentValue = false, Callback = function(V) Config.autoLuckEnabled = V end })
UpgradesTab:CreateSlider({ Name = "Luck Delay", Range = {0.1, 10}, Increment = 0.1, CurrentValue = 1, Callback = function(V) Config.luckUpgradeDelay = V end })
UpgradesTab:CreateToggle({ Name = "Auto Value Multiplier", CurrentValue = false, Callback = function(V) Config.autoValueEnabled = V end })
UpgradesTab:CreateSlider({ Name = "Value Delay", Range = {0.1, 10}, Increment = 0.1, CurrentValue = 1, Callback = function(V) Config.valueUpgradeDelay = V end })

-- Misc Tab (Anti-AFK)
local MiscTab = Window:CreateTab("🛡️ Misc", 7072718136)
MiscTab:CreateSection("Safety & Anti-Kick")
MiscTab:CreateLabel("Anti-AFK is active by default.")
MiscTab:CreateButton({
  Name = "Re-enable Anti-AFK",
  Callback = function() 
      Rayfield:Notify({Title = "Anti-AFK", Content = "Anti-AFK is running in the background.", Duration = 2}) 
  end
})

-- Settings Tab
local SettingsTab = Window:CreateTab("⚙️ Settings", 12591620)
SettingsTab:CreateButton({ Name = "Save Config", Callback = function() Rayfield:LoadConfiguration() end })

-- ==================== LOAD & READY ====================
Rayfield:LoadConfiguration()
Rayfield:Notify({ Title = "MJLHub v1.0.2", Content = "Script Loaded Successfully", Duration = 5, Image = 4483362458 })
