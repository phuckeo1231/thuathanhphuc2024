import { Avatar } from "antd";
import React from "react";

const TopNavbar = () => {
  return (
    <div className="flex flex-row items-center max-w-[500px] mx-auto justify-center  border-black border-2">
      <div className="font-bold w-[40%] text-center">Logo</div>
      <div className="font-bold w-[20%] border-r-2 border-black border-l-2 text-center">
        Blog
      </div>
      <div className="flex flex-row  items-center gap-3 w-[40%] justify-center">
        <Avatar src="https://images.unsplash.com/photo-1713190193924-8bd93c729b6b?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHwxMXx8fGVufDB8fHx8fA%3D%3D" />
        <div className="font-bold">Admin Levine</div>
      </div>
    </div>
  );
};

export default TopNavbar;
