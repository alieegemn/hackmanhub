local Players = game:GetService("Players")

local plataforma = Instance.new("Part")
plataforma.Name = "AntiVoidPlatform"
plataforma.Anchored = true
plataforma.CanCollide = true
plataforma.Transparency = 1
plataforma.Size = Vector3.new(100000, 2, 100000)
plataforma.Position = Vector3.new(0, -34, 0)
plataforma.Parent = workspace

local function onTouched(hit)
	local character = hit.Parent
	if character and Players:GetPlayerFromCharacter(character) then
		local humanoidRoot = character:FindFirstChild("HumanoidRootPart")
		if humanoidRoot then
			humanoidRoot.CFrame = CFrame.new(2, 23, -2)
		end
	end
end

plataforma.Touched:Connect(onTouched)
