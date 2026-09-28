import { Outlet } from "react-router"
import { Footer } from "@/components/layout/footer"

export default function HomeLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
   
        <div className="flex flex-1 items-start justify-center">
          <Outlet />
        </div>
        <Footer />
      </div>
    </div>
  )
}
