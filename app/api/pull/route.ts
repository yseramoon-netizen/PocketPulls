import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";



function rollRarity(){


const roll = Math.random() * 100;



if(roll < 0.2)
return "Secret Rare";


if(roll < 2)
return "Ultra Rare";


if(roll < 10)
return "Rare";


if(roll < 30)
return "Uncommon";


return "Common";


}







export async function POST(req:Request){


try{


const {
userId
}=await req.json();



if(!userId){

return NextResponse.json(
{
error:"Missing user"
},
{
status:400
}
);

}






// 1. DECIDE RARITY

let rarity = rollRarity();



console.log(
"RARITY ROLL:",
rarity
);






// 2. FIND CARDS OF THAT RARITY


let {
data:inventory,
error
}=await supabaseAdmin

.from("inventory")

.select(`

id,

quantity,

pokemon_cards(

id,

name,

image_url,

rarity,

market_value

)

`)

.gt(
"quantity",
0
);






if(error)
throw error;







// Filter rarity

let available = inventory?.filter(
(item:any)=>

item.pokemon_cards?.rarity
?.toLowerCase()
.includes(
rarity.toLowerCase()
)

);







// If no cards of rarity exist,
// fallback to any available card

if(!available || available.length===0){


console.log(
"No",
rarity,
"cards available. Falling back."
);


available = inventory || [];


}








// 3. WEIGHT BY QUANTITY


let pool:any[]=[];



available.forEach((item:any)=>{


for(
let i=0;
i<item.quantity;
i++
){

pool.push(item);

}


});







if(pool.length===0){


return NextResponse.json({

error:"No cards available"

});


}







// 4. SELECT CARD


const selected =

pool[
Math.floor(
Math.random()*pool.length
)
];





const card =
selected.pokemon_cards;








// 5. REMOVE FROM INVENTORY


await supabaseAdmin

.from("inventory")

.update({

quantity:
selected.quantity - 1

})

.eq(

"id",

selected.id

);









// 6. ADD TO COLLECTION


const {
data:existing
}=await supabaseAdmin

.from("user_cards")

.select("*")

.eq(
"user_id",
userId
)

.eq(
"card_id",
card.id
)

.maybeSingle();







if(existing){


await supabaseAdmin

.from("user_cards")

.update({

quantity:
existing.quantity + 1

})

.eq(
"id",
existing.id
);



}

else{


await supabaseAdmin

.from("user_cards")

.insert({

user_id:userId,

card_id:card.id,

quantity:1

});


}









// 7. SAVE HISTORY


await supabaseAdmin

.from("pull_history")

.insert({

user_id:userId,

card_id:card.id,

market_value:
card.market_value

});







return NextResponse.json({

success:true,

rarityRolled:rarity,

card

});








}
catch(error:any){


console.log(
error
);



return NextResponse.json({

error:error.message

},

{
status:500
});


}


}