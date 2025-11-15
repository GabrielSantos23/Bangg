import { Link, useNavigate } from "@tanstack/react-router";
import { ModeToggle } from "./mode-toggle";
import { Button } from "./ui/button";
import { logout } from "@/services/auth";

export default function Header() {
	const links = [{ to: "/", label: "Home" }] as const;
	 const navigate = useNavigate()
	async function handleLogout() {
    await logout()
    navigate({ to: '/Login' })
  }
	return (
		<div>
			<div className="flex flex-row items-center justify-between px-2 py-1">
				<nav className="flex gap-4 text-lg">
					{links.map(({ to, label }) => {
						return (
							<Link key={to} to={to}>
								{label}
							</Link>
						);
					})}
				</nav>
				<div className="flex items-center gap-2">
					<ModeToggle />
				</div>
				<Button variant="destructive" onClick={() => handleLogout()}>
            Logout
          </Button>
			</div>
			<hr />
		</div>
	);
}
