-- Sample Lua script
local function greet(name)
  local msg = "Hello, " .. name .. "!"
  print(msg)
  return #msg
end

local total = 0
for i = 1, 5 do
  total = total + greet("User" .. i)
end

print("Total chars:", total)

