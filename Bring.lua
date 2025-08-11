function bl(nome, caminho)
	local p = game.Players.LocalPlayer
	local hrp = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
	if not hrp then return end

	for _, item in ipairs(workspace.Items:GetChildren()) do
		if item.Name == nome then
			local partes = string.split(caminho, ".")
			local obj = item
			for _, parte in ipairs(partes) do
				obj = obj:FindFirstChild(parte)
				if not obj then break end
			end
			if obj and obj:IsA("BasePart") then
				obj.CFrame = hrp.CFrame + Vector3.new(math.random(-5,5), 0, math.random(-5,5))
			end
		end
	end
end

function bringBerry()
	bl("Berry", "Handle")
end

function bringEngine()
	bl("Old Car Engine", "Main")
end

function bringBarril()
	bl("Oil Barrel", "Main")
end

function bringMedKit()
	bl("MedKit", "Handle")
end

function bringArm2()
	bl("Iron Body", "Main")
end

function bringBolt()
	bl("Bolt", "Main")
end

function bringCoal()
	bl("Coal", "Coal")
end

function bringCarrot()
	bl("Carrot", "Handle")
end

function bringCoin()
	bl("Coin Stack", "Mossy Coin.Main")
end

function bringLog()
	bl("Log", "Main")
end

function bringVentilador()
	bl("Broken Fan", "Fans")
end

function bringFlashOld()
	bl("Old Flashlight", "Bulb")
end

function bringSheetMetal()
	bl("Sheet Metal", "Main")
end

function bringAmmo()
	bl("Rifle Ammo", "Main")
	bl("Revolver Ammo", "Main")
end

function bringRifle()
	bl("Rifle", "Adorn")
end

function bringRevolver()
	bl("Revolver", "Main")
end

function bringFuel()
	bl("Fuel Canister", "Main")
end

function bringRadio()
	bl("Old Radio", "Main")
end

function bringMicro()
	bl("Broken Microwave", "Main")
end

function bringRoda()
	bl("Tyre", "Main")
end

function bringChair()
	bl("Chair", "Part")
end

function bringMChair()
	bl("Metal Chair", "Part")
end

function bringBandage()
	bl("Bandage", "Handle")
end

function bringCake()
	bl("Cake", "Handle")
end

function bringArm1()
	bl("Leather Body", "Main")
end

function bringLavar()
	bl("Washing Machine", "Main")
end

function bringMorse()
	bl("Morsel", "Meat")
	bl("Cooked Morsel", "Meat")
end

function bringSteak()
	bl("Steak", "Main")
	bl("Cooked Steak", "Main")
end	
	
function BringMeat()
	bl("Cooked Steak", "Main")
	bl("Cooked Morsel", "Meat")
end

function bringFerr()
	bl("Good Axe", "Main")
	bl("Strong Axe", "Main")
	bl("Good Sack", "Sack")
	bl("Giant Sack", "Sack")
end


	
	
function tpfire()
	(game.Players.LocalPlayer.Character or game.Players.LocalPlayer.CharacterAdded:Wait()):WaitForChild("HumanoidRootPart").CFrame =
CFrame.new(0.43132782, 15.77634621, -1.88620758, -0.270917892, 0.102997094, 0.957076371, 0.639657021, 0.762253821, 0.0990355015, -0.719334781, 0.639031112, -0.272391081)
end



