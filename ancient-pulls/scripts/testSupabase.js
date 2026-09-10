require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);


async function test(){

const { data, error } = await supabase
.from("pokemon_cards")
.select("*")
.limit(1);


console.log("DATA:", data);
console.log("ERROR:", error);

}


test();