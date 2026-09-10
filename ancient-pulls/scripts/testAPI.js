require("dotenv").config({ path: ".env.local" });


async function test(){

const response = await fetch(
"https://api.pokemontcg.io/v2/cards?page=1&pageSize=5",
{
headers:{
"X-Api-Key": process.env.POKEMON_TCG_API_KEY
}
}
);


console.log("Status:", response.status);

const text = await response.text();

console.log(text.slice(0,500));

}


test();