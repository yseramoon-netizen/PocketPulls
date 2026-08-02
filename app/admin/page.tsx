"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

export default function AdminPage() {

  const [search, setSearch] = useState("");
  const [cards, setCards] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<any>(null);

  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState("");

  const [user, setUser] = useState<any>(null);

  const [message, setMessage] = useState("");



  useEffect(() => {

    getUser();

  }, []);




  async function getUser(){

    const {
      data:{
        user
      }
    } = await supabase.auth.getUser();


    setUser(user);

  }





  async function searchCards(value:string){

    setSearch(value);


    if(!value.trim()){

      setCards([]);

      return;

    }



    const {
      data,
      error
    } = await supabase

      .from("pokemon_cards")

      .select("*")

      .ilike(
        "name",
        `%${value}%`
      )

      .limit(20);



    if(error){

      console.log(error);
      return;

    }


    setCards(data || []);

  }








  async function addToInventory(){


    if(!selectedCard){

      alert("Select a Pokémon first");
      return;

    }


    if(!user){

      alert("You must be logged in");
      return;

    }




    const {
      data:existing,
      error:findError
    } = await supabase

      .from("inventory")

      .select(
        "id, quantity"
      )

      .eq(
        "card_id",
        selectedCard.id
      )

      .maybeSingle();





    if(findError){

      alert(findError.message);
      console.log(findError);
      return;

    }







    if(existing){



      const {
        error:updateError
      } = await supabase

        .from("inventory")

        .update({

          quantity:
            Number(existing.quantity)
            +
            Number(quantity)

        })

        .eq(
          "id",
          existing.id
        );





      if(updateError){

        alert(updateError.message);
        console.log(updateError);
        return;

      }




    } else {



      const {
        error:insertError
      } = await supabase

        .from("inventory")

        .insert({

          card_id:
            selectedCard.id,

          quantity:
            Number(quantity),

          status:
            "in_stock",

          location:
            location || "Default",

          added_by:
            user.email,

          added_by_user_id:
            user.id

        });





      if(insertError){

        alert(insertError.message);
        console.log(insertError);
        return;

      }



    }




    setMessage(
      `${selectedCard.name} added 🌿`
    );


    setSelectedCard(null);

    setQuantity(1);

    setLocation("");

  }









  return (

    <main className="
      min-h-screen
      bg-gradient-to-br
      from-emerald-950
      via-green-900
      to-lime-950
      text-white
      p-8
    ">


      <AdminNav />



      <div className="max-w-7xl mx-auto">


        <div className="
          flex
          justify-center
          items-center
          gap-5
          mb-10
        ">


          <img

            src="/shaymin.png"

            className="
              w-24
              h-24
              object-contain
              drop-shadow-[0_0_25px_rgba(134,239,172,0.8)]
            "

          />


          <div>

            <h1 className="
              text-5xl
              font-bold
              text-green-100
            ">

              PocketPulls

            </h1>


            <p className="
              text-green-300
              text-xl
            ">

              Fairy Forest Logger 🌿

            </p>


          </div>


        </div>





        <input

          className="
            w-full
            max-w-xl
            mx-auto
            block
            p-4
            rounded-full
            text-black
            shadow-xl
          "

          placeholder="🔍 Search Pokémon..."

          value={search}

          onChange={(e)=>
            searchCards(e.target.value)
          }

        />





        {message && (

          <p className="
            text-center
            text-green-200
            mt-5
          ">

            ✨ {message}

          </p>

        )}







        <div className="
          grid
          grid-cols-2
          md:grid-cols-4
          lg:grid-cols-6
          gap-6
          mt-10
        ">


          {cards.map(card=>(


            <div

              key={card.id}

              onClick={()=>
                setSelectedCard(card)
              }

              className="
                cursor-pointer
                bg-white/10
                rounded-3xl
                p-3
                border
                border-green-300/30
                hover:-translate-y-2
                transition
              "

            >


              <img

                src={card.image_url}

                className="
                  rounded-2xl
                "

              />


              <h2 className="
                mt-3
                font-bold
              ">

                {card.name}

              </h2>


              <p className="
                text-green-300
                text-sm
              ">

                {card.set_name}

              </p>


            </div>


          ))}


        </div>







        {selectedCard && (

          <div className="
            fixed
            bottom-8
            left-1/2
            -translate-x-1/2
            bg-green-950
            border
            border-green-300
            rounded-3xl
            p-6
            w-[90%]
            max-w-xl
            shadow-2xl
          ">



            <h2 className="
              text-3xl
              font-bold
            ">

              {selectedCard.name}

            </h2>





            <div className="
              flex
              justify-center
              items-center
              gap-5
              mt-5
            ">


              <button

                onClick={()=>
                  setQuantity(
                    Math.max(
                      1,
                      quantity-1
                    )
                  )
                }

                className="
                  bg-red-400
                  text-black
                  rounded-full
                  w-12
                  h-12
                "

              >

                -

              </button>



              <span className="text-3xl">

                {quantity}

              </span>



              <button

                onClick={()=>
                  setQuantity(quantity+1)
                }

                className="
                  bg-green-300
                  text-black
                  rounded-full
                  w-12
                  h-12
                "

              >

                +

              </button>


            </div>




            <input

              className="
                mt-5
                w-full
                p-3
                rounded-xl
                text-black
              "

              placeholder="Location"

              value={location}

              onChange={(e)=>
                setLocation(e.target.value)
              }

            />




            <button

              onClick={addToInventory}

              className="
                mt-5
                w-full
                bg-green-300
                text-black
                font-bold
                py-3
                rounded-xl
              "

            >

              Add To Inventory 🌿

            </button>



          </div>

        )}



      </div>


    </main>

  );

}