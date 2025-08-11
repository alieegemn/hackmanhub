function blm(nome, caminho, pos, extra)
	local p = game.Players.LocalPlayer
	if not pos then return end

	local x, y, z = string.match(pos, "([^,]+),%s*([^,]+),%s*([^,]+)")
	local destino = Vector3.new(tonumber(x) or 0, tonumber(y) or 0, tonumber(z) or 0)

	for _, item in ipairs(workspace.Items:GetChildren()) do
		if item.Name == nome then
			local partes = string.split(caminho, ".")
			local obj = item
			for _, parte in ipairs(partes) do
				obj = obj:FindFirstChild(parte)
				if not obj then break end
			end
			if obj and obj:IsA("BasePart") then
				if (obj.Position - destino).Magnitude > (extra or 30) then
					obj.CFrame = CFrame.new(destino)
				end
			end
		end
	end
end

function blmCom()
	blm("Coal", "Coal", "-15, 4, 0")
	blm("Oil Barrel", "Main", "-9, 4, -15")
	blm("Log", "Main", "-7, 4, 14")
	blm("Fuel Canister", "Main", "-30, 4, -0")
	blm("Chair", "Part", "-39, 4, -0")
end

function blmMet()
	blm("Old Car Engine", "Main", "35, 4, 19")
	blm("Bolt", "Main", "41, 4, 12")
	blm("Broken Fan", "Fans", "42, 4, 3")
	blm("Sheet Metal", "Main", "40, 4, -11")
	blm("Old Radio", "Main", "31, 4, -20")
	blm("Broken Microwave", "Main", "30, 4, -1")
	blm("Tyre", "Main", "55, 4, -1")
	blm("Metal Chair", "Part", "51, 4, 13")
        blm("Washing Machine", "Main", "54, 4, -19")
end


	
function blmMeat()
	blm("Steak", "Main", "-0, 6.5, 0", 0)
	blm("Morsel", "Meat", "-0, 6.5, 0", 0)
	task.wait(0.1)
	blm("Morsel", "Meat", "-0, 6.35, 0", 0)
end
