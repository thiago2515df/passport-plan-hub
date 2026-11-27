// Read-only diagnostic. Run via docker exec -i passport-plan-hub node --input-type=module < scripts/check-passhub-multi-room.mjs
const base = "https://partner-api.passhub.com.br/v1";
const key = process.env.PASSHUB_HOTEL_API_KEY;
const email = process.env.PASSHUB_API_EMAIL, password = process.env.PASSHUB_API_PASSWORD;
if (!key || !email || !password) throw new Error("Credenciais PassHub ausentes no container.");
async function request(path, body, token) {
  const r = await fetch(base + path, { method: body ? "POST" : "GET", headers: {"X-Api-Key":key,"Content-Type":"application/json", ...(token ? {Authorization:"Bearer "+token}: {})}, ...(body ? {body:JSON.stringify(body)}:{}), signal:AbortSignal.timeout(60000)});
  if(!r.ok) throw new Error(path + " HTTP " + r.status);
  return r.json();
}
const {accessToken} = await request("/auth/token",{email,password});
const d = await request("/hotel/destinations?q=Macei%C3%B3",null,accessToken);
const city = d.destinations?.find(x => x.type?.toLowerCase() === "city" && /^macei[oó](?:\s|,|$)/i.test(x.name));
if(!city) throw new Error("Destino Maceió não encontrado na API.");
const room1={adults:2,childAges:[7],quantity:1},room2={adults:2,childAges:[10],quantity:1};
const results={};
for(const [label,rooms] of [["dois_quartos",[room1,room2]],["quarto_1",[room1]],["quarto_2",[room2]]]){
  const r=await request("/searches",{type:"hotel",destinationId:city.destinationId,checkinDate:"2027-01-15",nights:3,rooms,ravPercentage:0},accessToken);
  const offers=r.offers??[];
  const selected=offers.filter(x=>/zuza\s+slim/i.test(x.hotel?.hotelName??""));
  const safeRoomFields = value => Array.isArray(value) ? value.slice(0,10).map(safeRoomFields) : value && typeof value==="object" ? Object.fromEntries(Object.entries(value).filter(([k])=>/^(rooms?|roomName|roomType|mealPlan|quantity|count|roomCount|adults|childAges|totalPrice|dailyPrice|price|amount|currency|total|nightlyPrice|rate|rates|priceBreakdown)$/i.test(k)).map(([k,v])=>[k,safeRoomFields(v)])) : value;
  results[label]={offers:offers.length,matching: selected.length, responseFields:Object.keys(r), sample:(selected.length?selected:offers.slice(0,1)).slice(0,8).map(o=>({hotel:o.hotel?.hotelName,fields:Object.keys(o),...safeRoomFields(o)}))};
}
console.log(JSON.stringify(results,null,2));
