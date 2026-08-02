import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";


async function getPrice(name:string, set:string, number:string){

  try {


    const query =
      `${name} ${set} ${number}`;


    const response = await fetch(

      `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(query)}`,

      {
        headers:{
          "User-Agent":
          "Mozilla/5.0"
        }
      }

    );



    if(!response.ok){

      console.log(
        "PRICE SEARCH FAILED:",
        response.status
      );

      return null;

    }



    const text =
      await response.text();




    const match =
      text.match(
        /\$([0-9]+\.[0-9]{2})/
      );



    if(!match){

      return null;

    }



    const usd =
      Number(match[1]);



    // USD -> GBP estimate

    const gbp =
      usd * 0.78;



    return Number(
      gbp.toFixed(2)
    );



  } catch(error){


    console.log(
      "PRICE ERROR:",
      name
    );


    return null;

  }

}





export async function GET(){


try{


const {data:inventory,error}=

await supabaseAdmin

.from("inventory")

.select(`
pokemon_cards(
id,
name,
set_name,
card_no,
market_value
)
`);




if(error) throw error;



let updated = 0;



for(const item of inventory || []){


const card:any =
item.pokemon_cards;



if(!card) continue;




const price = await getPrice(

card.name,

card.set_name,

card.card_no

);




if(price === null){


console.log(

"NO PRICE:",

card.name,

card.set_name

);


continue;


}





await supabaseAdmin

.from("pokemon_cards")

.update({

market_value:
price

})

.eq(

"id",

card.id

);




console.log(

"UPDATED:",

card.name,

"£",

price

);



updated++;



}





return NextResponse.json({

success:true,

updated

});



}catch(error:any){


console.log(error);



return NextResponse.json({

success:false,

error:error.message

},{

status:500

});


}


}