"use client"


import { useState } from "react";
import ComingSoonModal from "../coins/ComingSoonModal";

export default function Page() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-white"
      >
        Open Coming Soon
      </button>

      <ComingSoonModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}