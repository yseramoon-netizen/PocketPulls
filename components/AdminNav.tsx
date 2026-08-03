"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";


interface Props {
  hidden?: boolean;
}


export default function AdminNav({
  hidden = false
}: Props) {


const pathname = usePathname();


if(hidden)
return null;



const links = [

{
href:"/admin",
label:"Admin",
icon:"🌿"
},

{
href:"/admin/add",
label:"Add Card",
icon:"🌱"
},

{
href:"/admin/inventory",
label:"Inventory",
icon:"📦"
},

{
href:"/admin/pulls",
label:"Pull",
icon:"🎴"
},

{
href:"/wallet",
label:"Wallet",
icon:"💎"
}

];





return (

<>

<nav

className="

hidden

md:flex

items-center

justify-between

rounded-[3rem]

bg-white/10

backdrop-blur-3xl

border

border-white/20

shadow-[0_25px_80px_rgba(16,185,129,.25)]

p-5

mb-8

"

>


<div className="flex items-center gap-5">


<div

className="

relative

w-20

h-20

rounded-[2rem]

bg-emerald-400/20

backdrop-blur-xl

border

border-white/20

flex

items-center

justify-center

overflow-hidden

shadow-[0_0_70px_rgba(52,211,153,.5)]

"

>


<div

className="

absolute

inset-0

bg-gradient-to-br

from-white/20

to-transparent

"

/>



<img

src="/shaymin.png"

className="

relative

z-10

w-16

drop-shadow-2xl

"

/>


</div>





<h1

className="

text-3xl

font-black

text-white

tracking-tight

"

>

PocketPulls

</h1>



</div>







<div

className="

flex

gap-3

flex-wrap

justify-end

"

>


{

links.map(link=>(


<NavButton

key={link.label}

{...link}

active={pathname===link.href}

/>


))

}


</div>



</nav>









{/* MOBILE NAV */}



<nav

className="

fixed

bottom-5

left-5

right-5

md:hidden

z-50

rounded-[2rem]

bg-white/10

backdrop-blur-3xl

border

border-white/20

shadow-[0_20px_70px_rgba(16,185,129,.4)]

p-3

"

>


<div

className="

flex

justify-around

"

>


{

links.map(link=>(


<Link

key={link.label}

href={link.href}

className={`

flex

flex-col

items-center

rounded-2xl

px-3

py-2

font-black

transition


${

pathname===link.href

?

"bg-emerald-400/30 text-white scale-110"

:

"text-emerald-100"

}

`

}

>


<span className="text-xl">

{link.icon}

</span>


<span className="text-[10px]">

{link.label}

</span>


</Link>


))

}


</div>


</nav>


</>

);

}






function NavButton({

href,

label,

icon,

active

}:any){


return (

<Link

href={href}

className={`

flex

items-center

gap-2

rounded-2xl

px-5

py-3

font-black

transition-all


${

active

?

"bg-emerald-400/40 text-white shadow-[0_0_30px_rgba(52,211,153,.5)] scale-105"

:

"text-emerald-100 hover:bg-white/10"

}


`

}

>


<span className="text-xl">

{icon}

</span>


<span>

{label}

</span>


</Link>


);


}