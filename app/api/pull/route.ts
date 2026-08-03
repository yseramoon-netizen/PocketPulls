import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";


export async function POST(req: Request) {

  try {

    const { userId } = await req.json();


    if (!userId) {

      return NextResponse.json(
        {
          error: "User missing"
        },
        {
          status: 400
        }
      );

    }



    // GET USER BALANCE

    const {
      data: user,
      error: userError

    } = await supabase

      .from("profiles")

      .select("balance")

      .eq("id", userId)

      .single();



    if (userError || !user) {

      console.error(userError);

      return NextResponse.json(
        {
          error: "Profile not found"
        },
        {
          status: 400
        }
      );

    }



    const price = 1;



    if (Number(user.balance) < price) {

      return NextResponse.json(
        {
          error: "Insufficient balance"
        },
        {
          status:400
        }
      );

    }




    // GET REAL INVENTORY

    const {

      data: inventory,

      error: inventoryError

    } = await supabase

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

      .gt("quantity",0);





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




    // RANDOM REAL CARD

    const selected =
      inventory[
        Math.floor(Math.random()*inventory.length)
      ];



    const card = Array.isArray(selected.pokemon_cards)

      ? selected.pokemon_cards[0]

      : selected.pokemon_cards;



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





    // REMOVE CARD FROM INVENTORY

    const remaining =
      Number(selected.quantity)-1;



    if(remaining <= 0){


      await supabase

        .from("inventory")

        .delete()

        .eq(
          "id",
          selected.id
        );


    } else {


      await supabase

        .from("inventory")

        .update({

          quantity: remaining

        })

        .eq(
          "id",
          selected.id
        );


    }







    // SUBTRACT WALLET

    const newBalance =
      Number(user.balance)-price;



    const {

      data:updatedProfile,

      error:balanceError

    } = await supabase

      .from("profiles")

      .update({

        balance:newBalance

      })

      .eq(
        "id",
        userId
      )

      .select("balance")

      .single();





    if(balanceError){

      console.error(
        "Wallet update error:",
        balanceError
      );


      return NextResponse.json(
        {
          error:"Wallet update failed"
        },
        {
          status:500
        }
      );

    }





    console.log(
      "Wallet updated:",
      updatedProfile.balance
    );







    // SAVE DISCOVERY LOG

    const {

      error:historyError

    } = await supabase

      .from("pull_history")

      .insert({

        user_id:userId,

        card_id:card.id,

        market_value:Number(card.market_value || 0),

        amount_paid:price

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

        market_value:Number(card.market_value || 0)

      }

    });



  }

  catch(error:any){


    console.error(
      "Pull error:",
      error
    );


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