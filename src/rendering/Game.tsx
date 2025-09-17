"use client";

import React from "react";
import dynamic from "next/dynamic";

const Game = dynamic(() => import("./Render").then((m) => m.Render), { ssr: false });


export function GameWrapper() {  
  return (    
      <div className="absolute w-full h-[100svh]">
        <Game />
      </div>      
  
  );
}
