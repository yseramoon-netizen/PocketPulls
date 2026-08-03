"use client";


interface PullHistoryProps {

items:{
  id:string;
  name:string;
  rarity:string;
  value:number;
  created_at:string;
  image_url?:string;
}[];

}





export default function PullHistory({

items

}:PullHistoryProps){





function rarityStyle(rarity:string){

const r =
rarity?.toLowerCase() || "";


if(r.includes("secret"))

return "shadow-[0_0_40px_rgba(250,204,21,.7)] border-yellow-300/50";


if(r.includes("illustration"))

return "shadow-[0_0_40px_rgba(236,72,153,.6)] border-pink-400/50";


if(r.includes("ultra"))

return "shadow-[0_0_40px_rgba(59,130,246,.6)] border-blue-400/50";


if(r.includes("rare"))

return "shadow-[0_0_30px_rgba(250,204,21,.4)] border-yellow-300/30";


return "shadow-[0_0_25px_rgba(16,185,129,.3)] border-emerald-400/30";

}




function timeAgo(date:string){

const seconds =
Math.floor(
(Date.now()-new Date(date).getTime())/1000
);


if(seconds < 60)
return `${seconds}s ago`;


const minutes =
Math.floor(seconds/60);


if(minutes < 60)
return `${minutes}m ago`;


const hours =
Math.floor(minutes/60);


if(hours < 24)
return `${hours}h ago`;


const days =
Math.floor(hours/24);


return `${days}d ago`;

}









return(


<section

className="

mt-12

rounded-[3rem]

bg-white/10

backdrop-blur-2xl

border

border-white/20

p-8

shadow-[0_0_80px_rgba(16,185,129,.15)]

overflow-hidden

"

>



<div

className="

flex

justify-between

items-center

mb-8

"

>


<div>


<h2

className="

text-3xl

font-black

"

>

Recent Discoveries

</h2>


<p

className="

text-emerald-200

font-bold

mt-1

"

>

Worldwide forest activity

</p>


</div>





<div

className="

px-4

py-2

rounded-full

bg-emerald-400/20

border

border-emerald-300/30

text-emerald-100

font-black

text-sm

"

>

🌎 LIVE FEED

</div>



</div>









<div

className="

space-y-4

"

>


{

items.length === 0

?

<div

className="

text-center

py-14

text-emerald-200

font-bold

"

>

🌱 No discoveries yet

<br/>

<span className="text-sm opacity-70">

Be the first to awaken the forest

</span>

</div>


:


items.map((item)=>(



<div

key={item.id}

className={`

group

relative

flex

items-center

gap-5

rounded-[2rem]

bg-black/20

border

p-4

transition-all

duration-300

hover:bg-white/10

hover:scale-[1.02]

${rarityStyle(item.rarity)}

`}

>






<div

className="

relative

shrink-0

"

>


<div

className="

absolute

inset-0

rounded-2xl

bg-emerald-400/20

blur-xl

group-hover:bg-yellow-300/30

transition

"

/>





<img

src={
item.image_url || "/card-placeholder.png"
}

alt={item.name}

className="

relative

w-20

h-28

object-cover

rounded-2xl

shadow-xl

group-hover:scale-110

transition

duration-300

"

/>


</div>









<div

className="

flex-1

min-w-0

"

>


<h3

className="

font-black

text-lg

truncate

"

>

{item.name}

</h3>




<p

className="

text-emerald-200

text-sm

font-bold

"

>

{item.rarity}

</p>





<p

className="

text-gray-300

text-xs

mt-2

"

>

🌲 {timeAgo(item.created_at)}

</p>


</div>









<div

className="

text-right

"

>


<p

className="

font-black

text-xl

text-yellow-300

"

>

£{Number(item.value).toFixed(2)}

</p>


<p

className="

text-xs

text-gray-300

font-bold

"

>

VALUE

</p>


</div>








</div>



))


}



</div>







</section>


);


}