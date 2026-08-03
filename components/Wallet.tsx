"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";


interface WalletProps{

refreshKey?:number;

}



export default function Wallet({

refreshKey

}:WalletProps){



const [balance,setBalance]=useState(0);

const [loading,setLoading]=useState(true);






useEffect(()=>{

loadWallet();

},[refreshKey]);








async function loadWallet(){


const {

data:{
user

}

}=await supabase.auth.getUser();





if(!user){

setLoading(false);

return;

}






const {

data,

error

}=await supabase

.from("profiles")

.select(
"balance"
)

.eq(

"id",

user.id

)

.single();







if(error){

console.log(error);

setLoading(false);

return;

}






setBalance(

Number(data?.balance || 0)

);



setLoading(false);



}









if(loading){

return(

<div

className="

mt-6

h-32

rounded-[3rem]

bg-white/10

animate-pulse

"

/>

);

}








return(

<section

className="

relative

overflow-hidden

rounded-[3rem]

bg-white/10

backdrop-blur-3xl

border

border-white/20

p-8

shadow-[0_0_80px_rgba(16,185,129,.2)]

"

>





<div

className="

absolute

inset-0

bg-gradient-to-br

from-emerald-500/20

via-transparent

to-yellow-400/10

"

/>







<div

className="

relative

flex

items-center

justify-between

"

>



<div>


<p

className="

text-emerald-200

font-bold

"

>

🌲 Forest Wallet

</p>




<h2

className="

text-5xl

font-black

mt-2

"

>

£{balance.toFixed(2)}

</h2>



</div>







<div

className="

text-right

"

>


<div

className="

text-5xl

"

>

💎

</div>



<p

className="

text-emerald-200

font-bold

"

>

Available

</p>


</div>






</div>









<div

className="

mt-8

grid

md:grid-cols-2

gap-5

"

>





<div

className="

rounded-3xl

bg-black/30

border

border-white/10

p-5

"

>


<p

className="

text-emerald-200

font-bold

text-sm

"

>

Next Discovery

</p>


<p

className="

text-3xl

font-black

mt-2

"

>

£1

</p>



</div>








<div

className="

rounded-3xl

bg-black/30

border

border-white/10

p-5

"

>


<p

className="

text-emerald-200

font-bold

text-sm

"

>

Status

</p>



<p

className="

text-3xl

font-black

mt-2

text-emerald-300

"

>

Ready 🌱

</p>



</div>







</div>








</section>


);


}