import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";


export async function POST(req: Request){

try{


const body = await req.json();

const userId = body.userId;



if(!userId){

return NextResponse.json(
{
error:"User missing"
},
{
status:400
}
);

}




// GET USER WALLET

const {
data:user,
error:userError

}=await supabase

.from("profiles")

.select("balance")

.eq(
"id",
userId
)

.single();



if(userError || !user){

return NextResponse.json(
{
error:"Profile not found"
},
{
status:400
}
);

}




const price = 1;



if(Number(user.balance) < price){

return NextResponse.json(
{
error:"Insufficient balance"
},
{
status:400
}
);

}





// GET REAL INVENTORY

const {
data:inventory,
error:inventoryError

}=await supabase

.from("inventory")

.select(`

id,

quantity,

pokemon_cards(
id,
name,
rarity,
image_url,
market_value

)

`)

.gt(
"quantity",
0
);




if(inventoryError){

console.error(inventoryError);

return NextResponse.json(
{
error:"Inventory loading failed"
},
{
status:500
}
);

}




if(!inventory || inventory.length===0){

return NextResponse.json(
{
error:"Forest is empty"
},
{
status:400
}
);

}




// PICK RANDOM CARD

const selected =
inventory[
Math.floor(
Math.random()*inventory.length
)
];



const card = Array.isArray(selected.pokemon_cards)

?
selected.pokemon_cards[0]

:

selected.pokemon_cards;




if(!card){

return NextResponse.json(
{
error:"Card missing"
},
{
status:500
}
);

}




// REMOVE INVENTORY CARD

const remaining =
Number(selected.quantity)-1;



if(remaining<=0){


await supabase

.from("inventory")

.delete()

.eq(
"id",
selected.id
);


}

else{


await supabase

.from("inventory")

.update({

quantity:remaining

})

.eq(
"id",
selected.id
);


}





// REMOVE WALLET MONEY

await supabase

.from("profiles")

.update({

balance:
Number(user.balance)-price

})

.eq(
"id",
userId
);







// SAVE DISCOVERY HISTORY

const {
error:historyError

}=await supabase

.from("pull_history")

.insert({

user_id:userId,

card_id:card.id,

market_value:
Number(card.market_value || 0),

amount_paid:
price

});



if(historyError){

console.error(
"History save error:",
historyError
);

}





return NextResponse.json({

success:true,


card:{

id:card.id,

name:card.name,

rarity:card.rarity,

image_url:card.image_url,

market_value:
Number(card.market_value || 0)

}


});



}
catch(error:any){


console.error(error);


return NextResponse.json(
{
error:error.message || "Pull failed"
},
{
status:500
}
);


}


}