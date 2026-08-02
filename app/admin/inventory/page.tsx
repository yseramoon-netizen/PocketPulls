"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

export default function InventoryPage() {

  const [inventory, setInventory] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [updatingPrices, setUpdatingPrices] = useState(false);



  useEffect(() => {

    loadInventory();

  }, []);





  async function loadInventory() {

    setLoading(true);


    const { data, error } = await supabase

      .from("inventory")

      .select(`

        id,
        quantity,
        location,
        added_by_user_id,

        pokemon_cards(
          id,
          name,
          set_name,
          image_url,
          market_value
        ),

        profiles:added_by_user_id(
          name
        )

      `);



    if(error){

      console.log(error);

      setLoading(false);

      return;

    }



    setInventory(data || []);

    setFiltered(data || []);

    setLoading(false);

  }







  async function refreshPrices(){

    setUpdatingPrices(true);


    await fetch("/api/update-prices");


    await loadInventory();


    setUpdatingPrices(false);

  }







  function searchCards(value:string){

    setSearch(value);



    if(!value){

      setFiltered(inventory);

      return;

    }



    setFiltered(

      inventory.filter(item =>

        item.pokemon_cards?.name

        ?.toLowerCase()

        .includes(
          value.toLowerCase()
        )

      )

    );

  }







  async function changeQuantity(
    id:string,
    quantity:number,
    amount:number
  ){

    const newQuantity =
      quantity + amount;



    if(newQuantity <= 0){

      deleteCard(id);

      return;

    }



    await supabase

      .from("inventory")

      .update({

        quantity:newQuantity

      })

      .eq(
        "id",
        id
      );



    loadInventory();

  }







  async function deleteCard(id:string){

    const confirmDelete =
      confirm(
        "Delete this card?"
      );


    if(!confirmDelete)
      return;



    await supabase

      .from("inventory")

      .delete()

      .eq(
        "id",
        id
      );



    loadInventory();

  }







  const totalValue = filtered.reduce(

    (total,item)=>{

      return total +

      (

        Number(
          item.pokemon_cards?.market_value || 0
        )

        *

        Number(
          item.quantity || 0
        )

      );

    },

    0

  );








  if(loading){

    return (

      <main className="
      min-h-screen
      bg-gray-50
      flex
      items-center
      justify-center
      text-emerald-700
      text-xl
      ">

      Loading collection 🌿

      </main>

    );

  }









  return (

    <main className="
    min-h-screen
    bg-gray-50
    text-gray-900
    p-4
    md:p-8
    ">


      <div className="
      max-w-7xl
      mx-auto
      ">


      <AdminNav />







      <div className="
      flex
      flex-col
      sm:flex-row
      items-center
      gap-4
      mb-8
      ">



        <img

        src="/shaymin.png"

        className="
        w-20
        h-20
        object-contain
        "

        />



        <div>


        <h1 className="
        text-3xl
        md:text-5xl
        font-bold
        text-emerald-700
        ">

        Inventory

        </h1>



        <p className="
        text-gray-500
        ">

        Your Pokémon collection

        </p>


        </div>


      </div>







      <div className="
      bg-white
      rounded-3xl
      shadow-lg
      border
      border-gray-200
      p-6
      mb-8
      text-center
      ">



      <p className="
      text-gray-500
      ">

      Total Market Value

      </p>



      <h2 className="
      text-4xl
      md:text-5xl
      font-bold
      text-emerald-600
      ">

      £{totalValue.toFixed(2)}

      </h2>





      <button

      onClick={refreshPrices}

      disabled={updatingPrices}

      className="
      mt-5
      bg-emerald-600
      text-white
      px-6
      py-3
      rounded-full
      font-bold
      "

      >

      {
        updatingPrices
        ?
        "Updating..."
        :
        "Refresh Prices 💎"
      }


      </button>


      </div>









      <input

      value={search}

      onChange={(e)=>
        searchCards(
          e.target.value
        )
      }

      placeholder="Search Pokémon..."

      className="
      w-full
      bg-white
      border
      border-gray-200
      rounded-full
      p-4
      mb-8
      shadow-sm
      outline-none
      "

      />









      <div className="
      grid
      grid-cols-1
      sm:grid-cols-2
      md:grid-cols-3
      lg:grid-cols-5
      xl:grid-cols-6
      gap-5
      ">



      {filtered.map(item => (


        <div

        key={item.id}

        className="
        bg-white
        rounded-3xl
        shadow-md
        border
        border-gray-200
        p-4
        "

        >




        <img

        src={
          item.pokemon_cards?.image_url
        }

        className="
        w-full
        aspect-[3/4]
        object-cover
        rounded-2xl
        "

        />





        <h2 className="
        mt-3
        font-bold
        text-lg
        ">

        {item.pokemon_cards?.name}

        </h2>





        <p className="
        text-sm
        text-gray-500
        ">

        {item.pokemon_cards?.set_name}

        </p>







        <div className="
        mt-3
        text-sm
        space-y-1
        ">


        <p>
        📍 {item.location || "Unknown"}
        </p>


        <p>
        👤 {item.profiles?.name || "Unknown"}
        </p>


        </div>






        <p className="
        mt-3
        text-emerald-600
        font-bold
        ">

        💎 £{item.pokemon_cards?.market_value || 0}

        </p>








        <div className="
        flex
        justify-between
        items-center
        mt-4
        ">



        <button

        onClick={()=>
          changeQuantity(
            item.id,
            item.quantity,
            -1
          )
        }

        className="
        w-12
        h-12
        rounded-full
        bg-red-100
        text-red-600
        font-bold
        text-xl
        "

        >

        -

        </button>





        <span className="
        font-bold
        text-xl
        ">

        {item.quantity}

        </span>





        <button

        onClick={()=>
          changeQuantity(
            item.id,
            item.quantity,
            1
          )
        }

        className="
        w-12
        h-12
        rounded-full
        bg-emerald-100
        text-emerald-700
        font-bold
        text-xl
        "

        >

        +

        </button>


        </div>







        <button

        onClick={()=>
          deleteCard(item.id)
        }

        className="
        mt-4
        w-full
        bg-red-600
        text-white
        py-3
        rounded-xl
        font-bold
        "

        >

        Delete

        </button>




        </div>


      ))}



      </div>



      </div>


    </main>

  );

}