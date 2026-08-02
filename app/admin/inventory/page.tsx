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





  async function loadInventory(){


    setLoading(true);


    const {data,error}=await supabase

    .from("inventory")

    .select(`
      id,
      quantity,
      location,

      pokemon_cards(
        id,
        name,
        set_name,
        card_no,
        rarity,
        image_url,
        market_value
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



    try{


      const response = await fetch(
        "/api/update-prices"
      );


      const result =
      await response.json();



      console.log(
        "PRICE UPDATE:",
        result
      );



      await loadInventory();



    }catch(error){


      console.log(
        "PRICE UPDATE ERROR:",
        error
      );


    }



    setUpdatingPrices(false);


  }







  function searchCards(value:string){


    setSearch(value);



    const result =
    inventory.filter(item =>


      item.pokemon_cards?.name

      ?.toLowerCase()

      .includes(
        value.toLowerCase()
      )


    );


    setFiltered(result);


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



    const {error}=await supabase

    .from("inventory")

    .update({

      quantity:newQuantity

    })

    .eq(
      "id",
      id
    );



    if(error){

      console.log(error);
      return;

    }



    loadInventory();


  }







  async function deleteCard(id:string){


    const confirmDelete =
    window.confirm(
      "Delete this card from inventory?"
    );



    if(!confirmDelete) return;



    const {error}=await supabase

    .from("inventory")

    .delete()

    .eq(
      "id",
      id
    );



    if(error){

      console.log(error);
      alert(error.message);
      return;

    }



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
      bg-green-950
      text-white
      flex
      justify-center
      items-center
      text-2xl
      ">

      Loading collection 🌿

      </main>

    );


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



<div className="
max-w-7xl
mx-auto
">






<header className="
flex
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
"

/>



<div>

<h1 className="
text-5xl
font-bold
">

PocketPulls

</h1>


<p className="
text-green-300
text-xl
">

Your Collection 🌿

</p>


</div>


</header>







<div className="
bg-white/10
rounded-3xl
p-6
mb-8
text-center
">


<p>

Collection Value

</p>



<h2 className="
text-5xl
font-bold
text-green-300
">

£{totalValue.toFixed(2)}

</h2>





<button

onClick={refreshPrices}

disabled={updatingPrices}

className="
mt-5
bg-green-300
text-black
font-bold
px-8
py-3
rounded-full
hover:scale-105
transition
disabled:opacity-50
"

>

{

updatingPrices

?

"Updating Prices... 🌿"

:

"Refresh Market Prices 💎"

}


</button>




</div>







<input

className="
w-full
p-4
rounded-full
text-black
mb-10
"

placeholder="🔍 Search cards..."

value={search}

onChange={(e)=>
searchCards(e.target.value)
}

/>









<div className="
grid
grid-cols-2
md:grid-cols-4
lg:grid-cols-6
gap-6
">



{filtered.map(item=>(



<div

key={item.id}

className="
bg-white/10
rounded-3xl
p-4
border
border-green-300/20
">


<img

src={
item.pokemon_cards?.image_url
}

className="
rounded-2xl
"

/>



<h2 className="
font-bold
mt-3
">

{item.pokemon_cards?.name}

</h2>



<p className="
text-green-300
text-sm
">

{item.pokemon_cards?.set_name}

</p>





<p className="mt-3">

💎 £{
item.pokemon_cards?.market_value || 0
}

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
bg-red-400
text-black
rounded-full
w-10
h-10
font-bold
"

>

-

</button>




<span className="
text-xl
font-bold
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
bg-green-300
text-black
rounded-full
w-10
h-10
font-bold
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
rounded-xl
py-2
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