-- MJL HUB Advanced HD Cinematic Intro v2 - Enhanced VFX, Responsive, ~5s Runtime
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- =========================================================
-- 1. Config & Styling
-- =========================================================
local COLORS = {
	BG = Color3.fromRGB(8, 8, 10),
	CYAN = Color3.fromRGB(0, 225, 255),
	DARK_CYAN = Color3.fromRGB(0, 90, 140),
	WHITE = Color3.fromRGB(255, 255, 255)
}

local SFX_IDS = {
	AMBIENT = "rbxassetid://9114224217", -- Earthquake Explosion 3 (SFX) - deep rumble/boom, 28s
	IMPACT  = "rbxassetid://836142578",  -- Cinematic Bass Boom Sound Effect - punchy hit
	OUTRO   = "rbxassetid://9114444008"  -- Fire Whoosh 3 (SFX) - short exit whoosh
}

-- Detect mobile/touch to slightly scale UI for smaller screens
local isMobile = UserInputService.TouchEnabled and not UserInputService.MouseEnabled

local function playSFX(assetId, volume, pitch)
	local sound = Instance.new("Sound")
	sound.SoundId = assetId
	sound.Volume = volume or 0.5
	sound.PlaybackSpeed = pitch or 1
	sound.Parent = SoundService
	sound:Play()
	sound.Ended:Connect(function()
		sound:Destroy()
	end)
	return sound
end

-- =========================================================
-- 2. Core UI Setup (responsive container)
-- =========================================================
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "MJL_HD_Intro"
screenGui.IgnoreGuiInset = true
screenGui.ResetOnSpawn = false
screenGui.DisplayOrder = 999
screenGui.Parent = playerGui

local bg = Instance.new("Frame")
bg.Size = UDim2.new(1, 0, 1, 0)
bg.BackgroundColor3 = COLORS.BG
bg.BackgroundTransparency = 1
bg.Parent = screenGui

-- Central content holder keeps everything proportional on any aspect ratio
local content = Instance.new("Frame")
content.Name = "Content"
content.AnchorPoint = Vector2.new(0.5, 0.5)
content.Position = UDim2.new(0.5, 0, 0.5, 0)
content.Size = UDim2.new(1, 0, 1, 0)
content.BackgroundTransparency = 1
content.Parent = bg

local aspectGuard = Instance.new("UIAspectRatioConstraint")
aspectGuard.AspectRatio = 16 / 9
aspectGuard.DominantAxis = Enum.DominantAxis.Width
aspectGuard.Parent = content

-- Overall scale so mobile phones (smaller/narrower screens) don't feel cramped
local uiScale = Instance.new("UIScale")
uiScale.Scale = isMobile and 0.9 or 1
uiScale.Parent = content

-- =========================================================
-- 3. Cinematic Blur / Color Correction
-- =========================================================
local blur = Instance.new("BlurEffect")
blur.Size = 0
blur.Parent = Lighting

local colorCorrection = Instance.new("ColorCorrectionEffect")
colorCorrection.Brightness = 0
colorCorrection.Contrast = 0
colorCorrection.Saturation = 0
colorCorrection.Parent = Lighting

-- =========================================================
-- 4. Particle System (ambient float + radial burst)
-- =========================================================
local particleContainer = Instance.new("Folder")
particleContainer.Name = "VFX_Particles"
particleContainer.Parent = content

local function spawnFloatParticle()
	if bg.BackgroundTransparency >= 1 then return end

	local particle = Instance.new("Frame")
	particle.AnchorPoint = Vector2.new(0.5, 0.5)
	local size = math.random(2, 7)
	particle.Size = UDim2.new(0, size, 0, size)
	particle.Position = UDim2.new(math.random(), 0, 1.1, 0)
	particle.BackgroundColor3 = math.random() > 0.55 and COLORS.CYAN or COLORS.WHITE
	particle.BackgroundTransparency = 0.25
	particle.BorderSizePixel = 0
	particle.ZIndex = 1
	particle.Parent = particleContainer

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(1, 0)
	corner.Parent = particle

	local floatTime = math.random(14, 26) / 10
	local targetX = particle.Position.X.Scale + (math.random(-12, 12) / 100)

	TweenService:Create(particle, TweenInfo.new(floatTime, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Position = UDim2.new(targetX, 0, math.random(-15, 15) / 100, 0),
		BackgroundTransparency = 1
	}):Play()

	task.delay(floatTime, function() particle:Destroy() end)
end

-- Radial burst particles fired outward from center on impact
local function spawnBurstParticles(count)
	for i = 1, count do
		local particle = Instance.new("Frame")
		particle.AnchorPoint = Vector2.new(0.5, 0.5)
		local size = math.random(3, 8)
		particle.Size = UDim2.new(0, size, 0, size)
		particle.Position = UDim2.new(0.5, 0, 0.48, 0)
		particle.BackgroundColor3 = math.random() > 0.5 and COLORS.CYAN or COLORS.WHITE
		particle.BackgroundTransparency = 0.1
		particle.BorderSizePixel = 0
		particle.ZIndex = 2
		particle.Parent = particleContainer

		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(1, 0)
		corner.Parent = particle

		local angle = math.rad(math.random(0, 360))
		local distance = math.random(15, 45) / 100
		local targetX = 0.5 + math.cos(angle) * distance
		local targetY = 0.48 + math.sin(angle) * distance * 0.6

		local burstTime = math.random(5, 9) / 10
		TweenService:Create(particle, TweenInfo.new(burstTime, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Position = UDim2.new(targetX, 0, targetY, 0),
			BackgroundTransparency = 1,
			Size = UDim2.new(0, 1, 0, 1)
		}):Play()

		task.delay(burstTime, function() particle:Destroy() end)
	end
end

-- =========================================================
-- 5. Expanding Energy Ring (impact shockwave)
-- =========================================================
local function spawnShockRing()
	local ring = Instance.new("Frame")
	ring.AnchorPoint = Vector2.new(0.5, 0.5)
	ring.Position = UDim2.new(0.5, 0, 0.48, 0)
	ring.Size = UDim2.new(0, 10, 0, 10)
	ring.BackgroundTransparency = 1
	ring.ZIndex = 1
	ring.Parent = content

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(1, 0)
	corner.Parent = ring

	local stroke = Instance.new("UIStroke")
	stroke.Color = COLORS.CYAN
	stroke.Thickness = 4
	stroke.Transparency = 0
	stroke.Parent = ring

	TweenService:Create(ring, TweenInfo.new(0.6, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Size = UDim2.new(0, 700, 0, 700)
	}):Play()
	TweenService:Create(stroke, TweenInfo.new(0.6, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Transparency = 1
	}):Play()

	task.delay(0.65, function() ring:Destroy() end)
end

-- =========================================================
-- 6. Title, Subtitle, Glow
-- =========================================================
local title = Instance.new("TextLabel")
title.Name = "Title"
title.Text = "MJL HUB"
title.Font = Enum.Font.GothamBlack
title.TextScaled = true
title.TextColor3 = COLORS.WHITE
title.BackgroundTransparency = 1
title.Size = UDim2.new(0.55, 0, 0.16, 0)
title.Position = UDim2.new(0.5, 0, 0.48, 0)
title.AnchorPoint = Vector2.new(0.5, 0.5)
title.ZIndex = 3
title.Parent = content

local titleSizeConstraint = Instance.new("UITextSizeConstraint")
titleSizeConstraint.MaxTextSize = isMobile and 56 or 72
titleSizeConstraint.Parent = title

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

local subtitle = Instance.new("TextLabel")
subtitle.Name = "Subtitle"
subtitle.Text = "E X P E R I E N C E   T H E   F U T U R E"
subtitle.Font = Enum.Font.GothamBold
subtitle.TextScaled = true
subtitle.TextColor3 = COLORS.CYAN
subtitle.BackgroundTransparency = 1
subtitle.Size = UDim2.new(0.45, 0, 0.035, 0)
subtitle.Position = UDim2.new(0.5, 0, 0.585, 0)
subtitle.AnchorPoint = Vector2.new(0.5, 0.5)
subtitle.TextTransparency = 1
subtitle.ZIndex = 3
subtitle.Parent = content

local subSizeConstraint = Instance.new("UITextSizeConstraint")
subSizeConstraint.MaxTextSize = isMobile and 16 or 20
subSizeConstraint.Parent = subtitle

-- Thin accent line that draws outward under the subtitle
local accentLine = Instance.new("Frame")
accentLine.AnchorPoint = Vector2.new(0.5, 0.5)
accentLine.Position = UDim2.new(0.5, 0, 0.635, 0)
accentLine.Size = UDim2.new(0, 0, 0, 2)
accentLine.BackgroundColor3 = COLORS.CYAN
accentLine.BackgroundTransparency = 0.2
accentLine.BorderSizePixel = 0
accentLine.ZIndex = 3
accentLine.Parent = content

-- =========================================================
-- 7. Master Animation Timeline (~5 seconds total)
-- =========================================================
task.spawn(function()
	local ambientParticleLoop = true
	task.spawn(function()
		while ambientParticleLoop and bg:IsDescendantOf(game) and bg.BackgroundTransparency < 1 do
			spawnFloatParticle()
			spawnFloatParticle()
			task.wait(0.05)
		end
	end)

	-- Phase 1: Fade in (0 - 0.5s)
	local ambientSound = playSFX(SFX_IDS.AMBIENT, 0.6, 1)
	TweenService:Create(bg, TweenInfo.new(0.5, Enum.EasingStyle.Quad), {BackgroundTransparency = 0}):Play()
	TweenService:Create(blur, TweenInfo.new(0.7, Enum.EasingStyle.Quad), {Size = 22}):Play()
	TweenService:Create(colorCorrection, TweenInfo.new(0.7, Enum.EasingStyle.Quad), {Contrast = 0.15, Saturation = 0.1}):Play()
	task.wait(0.45)

	-- Phase 2: Title impact (0.45 - 1.1s)
	title.Size = UDim2.new(0.08, 0, 0.03, 0)
	title.TextTransparency = 0

	TweenService:Create(title, TweenInfo.new(0.6, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		Size = UDim2.new(0.55, 0, 0.16, 0)
	}):Play()

	playSFX(SFX_IDS.IMPACT, 0.8, 1)
	spawnShockRing()
	spawnBurstParticles(18)

	colorCorrection.Brightness = 0.45
	TweenService:Create(colorCorrection, TweenInfo.new(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {Brightness = 0}):Play()

	-- Screen shake
	local shakeEndTime = os.clock() + 0.3
	local shakeConnection
	shakeConnection = RunService.RenderStepped:Connect(function()
		if os.clock() > shakeEndTime then
			title.Position = UDim2.new(0.5, 0, 0.48, 0)
			shakeConnection:Disconnect()
		else
			local intensity = 0.006 * ((shakeEndTime - os.clock()) / 0.3)
			title.Position = UDim2.new(0.5 + (math.random(-10, 10) * intensity), 0, 0.48 + (math.random(-10, 10) * intensity), 0)
		end
	end)

	task.wait(0.55)

	-- Phase 3: Shimmer, subtitle, accent line (1.0 - 1.6s)
	TweenService:Create(gradient, TweenInfo.new(1.2, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out), {Offset = Vector2.new(1.5, 0)}):Play()
	TweenService:Create(subtitle, TweenInfo.new(0.5, Enum.EasingStyle.Quad), {TextTransparency = 0}):Play()
	TweenService:Create(accentLine, TweenInfo.new(0.6, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {Size = UDim2.new(0.25, 0, 0, 2)}):Play()

	local pulseTween = TweenService:Create(strokeGlow, TweenInfo.new(0.9, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
		Thickness = 12,
		Transparency = 0.7
	})
	pulseTween:Play()

	-- Phase 4: Hold (display for readability) — brings total runtime to ~5s
	task.wait(2.3)

	-- Phase 5: Outro (last ~0.7s)
	pulseTween:Cancel()
	ambientParticleLoop = false

	if ambientSound and ambientSound.Parent then
		TweenService:Create(ambientSound, TweenInfo.new(0.4), {Volume = 0}):Play()
	end
	playSFX(SFX_IDS.OUTRO, 0.7, 1)

	local outroInfo = TweenInfo.new(0.6, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
	TweenService:Create(bg, outroInfo, {BackgroundTransparency = 1}):Play()
	TweenService:Create(title, outroInfo, {TextTransparency = 1}):Play()
	TweenService:Create(subtitle, outroInfo, {TextTransparency = 1}):Play()
	TweenService:Create(accentLine, outroInfo, {BackgroundTransparency = 1}):Play()
	TweenService:Create(strokeGlow, outroInfo, {Transparency = 1}):Play()
	TweenService:Create(strokeMain, outroInfo, {Transparency = 1}):Play()
	TweenService:Create(blur, outroInfo, {Size = 0}):Play()
	TweenService:Create(colorCorrection, outroInfo, {Contrast = 0, Saturation = 0}):Play()

	task.wait(0.6)

	-- Cleanup
	screenGui:Destroy()
	blur:Destroy()
	colorCorrection:Destroy()
end)