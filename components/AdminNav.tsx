"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  hidden?: boolean;
}

export default function AdminNav({ hidden = false }: Props) {


  const pathname = usePathname();


  if(hidden){
    return null;
  }



  const links = [
    {
      href: "/admin",
      label: "Forest",
      icon: "🌿",
    },
    {
      href: "/admin/add",
      label: "Add Cards",
      icon: "🌱",
    },
    {
      href: "/admin/inventory",
      label: "Inventory",
      icon: "📦",
    },
 {
href:"/admin/pulls",
label:"Pulls",
icon:"🎴",
},
    {
      href: "#",
      label: "Analytics",
      icon: "📊",
    },
  ];





  return (

    <>


      {/* Desktop Navigation */}

      <nav
        className="
        hidden
        md:flex
        items-center
        justify-between
        bg-white
        border
        border-emerald-100
        rounded-3xl
        shadow-md
        p-4
        mb-8
        "
      >


        <div
          className="
          text-2xl
          font-bold
          text-emerald-700
          "
        >
          🌿 PocketPulls
        </div>



        <div
          className="
          flex
          gap-3
          "
        >

          {links.map(link=>(

            <NavLink
              key={link.label}
              {...link}
              active={
                pathname === link.href
              }
            />

          ))}

        </div>


      </nav>









      {/* Mobile Navigation */}

      <nav

className="
fixed
bottom-0
left-0
right-0
md:hidden
bg-white/95
backdrop-blur-xl
border-t
border-emerald-100
shadow-[0_-5px_20px_rgba(0,0,0,0.08)]
p-3
flex
justify-around
z-50
h-20
"

      >


        {links.map(link=>(

          <Link

            key={link.label}

            href={link.href}

            className={`

              flex

              flex-col

              items-center

              text-[11px]

              transition


              ${
                pathname === link.href

                ?

                "text-emerald-700 scale-110 font-bold"

                :

                "text-gray-500"

              }

            `}

          >


            <span className="text-xl">

              {link.icon}

            </span>


            <span>

              {link.label}

            </span>


          </Link>

        ))}


      </nav>


    </>

  );

}







function NavLink({

href,
label,
icon,
active

}:any){


return (

<Link

href={href}

className={`

px-4

py-2

rounded-2xl

font-semibold

transition


${
active

?

"bg-emerald-600 text-white"

:

"text-gray-600 hover:bg-emerald-50"

}

`}

>

{icon} {label}

</Link>

);


}