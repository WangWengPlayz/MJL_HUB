-- MJL HUB Advanced HD Cinematic Intro - Sound & VFX Enhanced
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- 1. Configuration & HD Styling
local COLORS = {
  BG = Color3.fromRGB(10, 10, 12),
  CYAN = Color3.fromRGB(0, 225, 255),
  DARK_CYAN = Color3.fromRGB(0, 100, 150),
  WHITE = Color3.fromRGB(255, 255, 255)
}

-- 2. SFX Configuration (Uses standard Roblox asset IDs)
local SFX_IDS = {
  AMBIENT = "rbxassetid://9114223171", -- Deep cinematic ambient sweep/rumble
  IMPACT  = "rbxassetid://5536480982", -- Heavy metal punch / shockwave explosion
  OUTRO   = "rbxassetid://9114221379"  -- Futuristic high-tech bass drop / sweep out
}

-- Helper function to generate local UI sounds safely
local function playSFX(assetId, volume, pitch)
  local sound = Instance.new("Sound")
  sound.SoundId = assetId
  sound.Volume = volume or 0.5
  sound.PlaybackSpeed = pitch or 1
  sound.PlayOnRemove = false
  sound.Parent = SoundService
  sound:Play()

  -- Automatic cleanup once finished
  sound.Ended:Connect(function()
    sound:Destroy()
  end)
  return sound
end

-- 3. Core UI Setup
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "MJL_HD_Intro"
screenGui.IgnoreGuiInset = true
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

local bg = Instance.new("Frame")
bg.Size = UDim2.new(1, 0, 1, 0)
bg.BackgroundColor3 = COLORS.BG
bg.BackgroundTransparency = 1 
bg.Parent = screenGui

-- 4. Cinematic Blur & Color Correction
local blur = Instance.new("BlurEffect")
blur.Size = 0
blur.Parent = Lighting

local colorCorrection = Instance.new("ColorCorrectionEffect")
colorCorrection.Brightness = 0
colorCorrection.Contrast = 0
colorCorrection.Saturation = 0
colorCorrection.Parent = Lighting

-- 5. Particle System (Custom UI Emitters)
local particleContainer = Instance.new("Folder")
particleContainer.Name = "VFX_Particles"
particleContainer.Parent = bg

local function spawnUIParticle()
  if not bg:IsDescendantOf(game) or bg.BackgroundTransparency >= 1 then return end

  local particle = Instance.new("Frame")
  particle.AnchorPoint = Vector2.new(0.5, 0.5)

  local size = math.random(2, 6)
  particle.Size = UDim2.new(0, size, 0, size)
  particle.Position = UDim2.new(math.random(), 0, 1.1, 0)
  particle.BackgroundColor3 = math.random() > 0.4 and COLORS.CYAN or COLORS.WHITE
  particle.BackgroundTransparency = 0.3
  particle.BorderSizePixel = 0
  particle.Parent = particleContainer

  local corner = Instance.new("UICorner")
  corner.CornerRadius = UDim.new(1, 0)
  corner.Parent = particle

  local floatTime = math.random(20, 40) / 10
  local targetX = particle.Position.X.Scale + (math.random(-10, 10) / 100)

  TweenService:Create(particle, TweenInfo.new(floatTime, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
    Position = UDim2.new(targetX, 0, math.random(-0.1, 0.2), 0),
    BackgroundTransparency = 1
  }):Play()

  task.delay(floatTime, function() particle:Destroy() end)
end

-- 6. Main Title & Dynamic Text Glow
local title = Instance.new("TextLabel")
title.Text = "MJL HUB"
title.Font = Enum.Font.GothamBlack
title.TextScaled = true
title.TextColor3 = COLORS.WHITE
title.BackgroundTransparency = 1
title.Size = UDim2.new(0.5, 0, 0.15, 0)
title.Position = UDim2.new(0.5, 0, 0.48, 0)
title.AnchorPoint = Vector2.new(0.5, 0.5)
title.Parent = bg

local strokeGlow = Instance.new("UIStroke")
strokeGlow.Color = COLORS.CYAN
strokeGlow.Thickness = 6
strokeGlow.Transparency = 0.4
strokeGlow.Parent = title

local strokeMain = Instance.new("UIStroke")
strokeMain.Color = COLORS.DARK_CYAN
strokeMain.Thickness = 2
strokeMain.Transparency = 0
strokeMain.Parent = title

local gradient = Instance.new("UIGradient")
gradient.Color = ColorSequence.new({
  ColorSequenceKeypoint.new(0, COLORS.WHITE),
  ColorSequenceKeypoint.new(0.4, COLORS.CYAN),
  ColorSequenceKeypoint.new(0.5, COLORS.WHITE),
  ColorSequenceKeypoint.new(0.6, COLORS.CYAN),
  ColorSequenceKeypoint.new(1, COLORS.WHITE)
})
gradient.Rotation = 45
gradient.Offset = Vector2.new(-1.5, 0)
gradient.Parent = title

-- 7. Subtitle
local subtitle = Instance.new("TextLabel")
subtitle.Text = "E X P E R I E N C E   T H E   F U T U R E"
subtitle.Font = Enum.Font.GothamBold
subtitle.TextScaled = true
subtitle.TextColor3 = COLORS.CYAN
subtitle.BackgroundTransparency = 1
subtitle.Size = UDim2.new(0.4, 0, 0.03, 0)
subtitle.Position = UDim2.new(0.5, 0, 0.58, 0)
subtitle.AnchorPoint = Vector2.new(0.5, 0.5)
subtitle.TextTransparency = 1
subtitle.Parent = bg

-- 8. High-Fidelity Animation Sequence
task.spawn(function()
  task.spawn(function()
    while bg:IsDescendantOf(game) and bg.BackgroundTransparency < 1 do
      spawnUIParticle()
      task.wait(0.08)
    end
  end)

  -- Phase 1: Heavy Cinematic Ambient Fade-in
  local ambientSound = playSFX(SFX_IDS.AMBIENT, 0.6, 1)
  TweenService:Create(bg, TweenInfo.new(0.8, Enum.EasingStyle.Quad), {BackgroundTransparency = 0}):Play()
  TweenService:Create(blur, TweenInfo.new(1, Enum.EasingStyle.Quad), {Size = 20}):Play()
  TweenService:Create(colorCorrection, TweenInfo.new(1, Enum.EasingStyle.Quad), {Contrast = 0.15, Saturation = 0.1}):Play()
  task.wait(0.6)

  -- Phase 2: Explosive Title Entry & Impact Sound
  title.Size = UDim2.new(0.1, 0, 0.03, 0)
  title.TextTransparency = 0

  local titleTween = TweenService:Create(title, TweenInfo.new(0.8, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
    Size = UDim2.new(0.5, 0, 0.15, 0)
  })
  titleTween:Play()

  -- TRIGGER EXPLOSION SFX HERE
  playSFX(SFX_IDS.IMPACT, 0.8, 1)

  colorCorrection.Brightness = 0.4
  TweenService:Create(colorCorrection, TweenInfo.new(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {Brightness = 0}):Play()

  -- Screen Shake Effect
  local shakeEndTime = os.clock() + 0.4
  local shakeConnection
  shakeConnection = RunService.RenderStepped:Connect(function()
    if os.clock() > shakeEndTime then
      title.Position = UDim2.new(0.5, 0, 0.48, 0)
      shakeConnection:Disconnect()
    else
      local intensity = 0.005 * ((shakeEndTime - os.clock()) / 0.4)
      title.Position = UDim2.new(0.5 + (math.random(-10, 10) * intensity), 0, 0.48 + (math.random(-10, 10) * intensity), 0)
    end
  end)

  -- Phase 3: Text Shimmer & Glow Pulsing
  task.wait(0.2)
  TweenService:Create(gradient, TweenInfo.new(1.5, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out), {Offset = Vector2.new(1.5, 0)}):Play()
  TweenService:Create(subtitle, TweenInfo.new(0.6, Enum.EasingStyle.Quad), {TextTransparency = 0}):Play()

  local pulseTween = TweenService:Create(strokeGlow, TweenInfo.new(1, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
    Thickness = 12,
    Transparency = 0.7
  })
  pulseTween:Play()

  task.wait(2.2) -- Total cinematic display hold

  -- Phase 4: Clean Outro Exit & Sweep SFX
  pulseTween:Cancel()

  -- Smoothly fade out ambient sound if it's still running, and play exit SFX
  if ambientSound and ambientSound.Parent then
    TweenService:Create(ambientSound, TweenInfo.new(0.5), {Volume = 0}):Play()
  end
  playSFX(SFX_IDS.OUTRO, 0.7, 1)

  local outroInfo = TweenInfo.new(0.7, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
  TweenService:Create(bg, outroInfo, {BackgroundTransparency = 1}):Play()
  TweenService:Create(title, outroInfo, {TextTransparency = 1}):Play()
  TweenService:Create(subtitle, outroInfo, {TextTransparency = 1}):Play()
  TweenService:Create(strokeGlow, outroInfo, {Transparency = 1}):Play()
  TweenService:Create(strokeMain, outroInfo, {Transparency = 1}):Play()
  TweenService:Create(blur, outroInfo, {Size = 0}):Play()
  TweenService:Create(colorCorrection, outroInfo, {Contrast = 0, Saturation = 0}):Play()

  task.wait(0.7)

  -- Clean up memory completely
  screenGui:Destroy()
  blur:Destroy()
  colorCorrection:Destroy()
end)
