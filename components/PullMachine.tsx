"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";


interface PullMachineProps {

  onComplete: () => void;

  opening: boolean;

}



export default function PullMachine({

  onComplete,

  opening

}: PullMachineProps){



  const [stage,setStage] = useState<
    "idle" |
    "forest" |
    "energy" |
    "portal" |
    "reveal"
  >("idle");



  useEffect(()=>{


    if(!opening){

      setStage("idle");

      return;

    }



    setStage("forest");



    const timers = [

      setTimeout(()=>{

        setStage("energy");

      },1200),



      setTimeout(()=>{

        setStage("portal");

      },2500),



      setTimeout(()=>{

        setStage("reveal");

        onComplete();

      },4200)

    ];



    return ()=>{

      timers.forEach(clearTimeout);

    };


  },[opening]);






  return (

    <div

      className="
      relative
      h-[420px]
      w-full
      flex
      items-center
      justify-center
      overflow-hidden
      rounded-[3rem]
      "

    >



      {/* Forest glow */}

      <motion.div

        animate={

          stage !== "idle"

          ?

          {
            opacity:1,
            scale:1.2
          }

          :

          {
            opacity:0
          }

        }


        transition={{
          duration:2
        }}


        className="
        absolute
        w-96
        h-96
        rounded-full
        bg-emerald-400/20
        blur-3xl
        "

      />







      {/* Floating energy */}

      <AnimatePresence>


      {
        stage==="energy" && (

          <>

          {
            Array.from({
              length:20
            }).map((_,i)=>(

              <motion.div

                key={i}

                initial={{

                  opacity:0,

                  y:100,

                  x:0

                }}


                animate={{

                  opacity:1,

                  y:-150,

                  x:
                  Math.random()*300-150

                }}


                exit={{
                  opacity:0
                }}


                transition={{

                  duration:2,

                  delay:i*0.05

                }}


                className="
                absolute
                w-3
                h-3
                bg-yellow-300
                rounded-full
                shadow-[0_0_25px_10px_rgba(253,224,71,.8)]
                "

              />


            ))

          }


          </>

        )
      }


      </AnimatePresence>









      {/* Portal */}


      <AnimatePresence>


      {
        stage==="portal" && (


          <motion.div

            initial={{

              scale:0,

              rotate:0

            }}


            animate={{

              scale:1,

              rotate:360

            }}


            transition={{

              duration:1.5,

              ease:"backOut"

            }}


            className="
            relative
            w-52
            h-52
            rounded-full
            bg-gradient-to-br
            from-yellow-300
            via-orange-400
            to-red-500
            shadow-[0_0_80px_rgba(250,204,21,.9)]
            flex
            items-center
            justify-center
            "

          >


            <div

              className="
              text-8xl
              "

            >

              🎴

            </div>



          </motion.div>


        )
      }


      </AnimatePresence>









      {/* Final flash */}


      <AnimatePresence>


      {

        stage==="reveal" && (


          <motion.div

            initial={{

              opacity:0,

              scale:0

            }}


            animate={{

              opacity:1,

              scale:2

            }}


            transition={{

              duration:.7

            }}


            className="
            absolute
            inset-0
            bg-white
            rounded-[3rem]
            "

          />


        )

      }


      </AnimatePresence>









      {

        stage!=="idle" && (


          <motion.h2

            initial={{

              opacity:0

            }}


            animate={{

              opacity:1

            }}


            className="
            absolute
            bottom-10
            text-xl
            font-black
            text-white
            drop-shadow-xl
            "

          >

            {

              stage==="forest"

              ?

              "🌲 The forest awakens..."

              :

              stage==="energy"

              ?

              "✨ Something is calling..."

              :

              stage==="portal"

              ?

              "🎴 A discovery awaits..."

              :

              "🌟 Revealing..."

            }


          </motion.h2>


        )

      }



    </div>


  );

}