import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";



async function getPrice(
  name:string,
  set:string,
  number:string
){

  try {


    const query =
      `${name} ${set} ${number}`;



    const response = await fetch(

      `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(query)}`,

      {
        method:"GET",

        headers:{
          "User-Agent":
          "Mozilla/5.0"
        },

        cache:"no-store"

      }

    );



    if(!response.ok){

      console.log(
        "PRICE SEARCH FAILED:",
        response.status
      );

      return null;

    }



    const html =
      await response.text();




    const match =
      html.match(
        /\$([0-9]+\.[0-9]{2})/
      );



    if(!match){

      console.log(
        "NO PRICE FOUND:",
        query
      );

      return null;

    }



    const usd =
      Number(match[1]);



    const gbp =
      usd * 0.78;



    return Number(
      gbp.toFixed(2)
    );



  }

  catch(error){

    console.log(
      "PRICE ERROR:",
      name,
      error
    );


    return null;

  }

}






async function updatePrices(){


  try{


    const {
      data:inventory,
      error
    } = await supabaseAdmin

    .from("inventory")

    .select(`

      pokemon_cards(

        id,

        name,

        set_name,

        card_no

      )

    `);



    if(error){

      throw error;

    }



    let updated = 0;

    let failed = 0;





    for(const item of inventory || []){


      const card:any =
        item.pokemon_cards;



      if(!card){

        continue;

      }





      const price =
        await getPrice(

          card.name,

          card.set_name,

          card.card_no

        );





      if(price === null){

        failed++;

        continue;

      }





      const {
        error:updateError
      } = await supabaseAdmin

      .from("pokemon_cards")

      .update({

        market_value:price

      })

      .eq(

        "id",

        card.id

      );





      if(updateError){

        console.log(
          "UPDATE FAILED:",
          updateError
        );

        failed++;

        continue;

      }




      console.log(

        "UPDATED:",

        card.name,

        "£"+price

      );



      updated++;



    }





    return NextResponse.json({

      success:true,

      updated,

      failed

    });



  }


  catch(error:any){



    console.log(
      "UPDATE PRICES ERROR:",
      error
    );



    return NextResponse.json(

      {

        success:false,

        error:error.message

      },

      {

        status:500

      }

    );


  }


}







export async function GET(){

  return updatePrices();

}





export async function POST(){

  return updatePrices();

}