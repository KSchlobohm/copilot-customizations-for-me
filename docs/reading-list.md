 # Reading List
 
Reference material worth sharing because it is useful, interesting, or both.
 
 ---
 
 ## AI Usage

Practical reading on using AI in engineering work.

| Title | Source | What it is | Why it matters |
|---|---|---|---|
| [AI Made Us Faster. That Was the Problem.](https://www.linkedin.com/pulse/ai-made-us-faster-problem-david-fowler-mgnzc/) | David Fowler | A short piece on how AI increases delivery speed faster than teams can safely review, integrate, and absorb. | It is a useful reminder that faster output only helps when team practices keep quality, review, and decision-making under control. |
 | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | GitHub (Addy Osmani) | A repository of 23 production-grade engineering skills, steps, verification gates, and workflows for AI coding agents. | Excellent reference examples for designing structured agent instructions, verification gates, and lifecycle commands. |
 
 ---
 
 ## Modernization
 
Recommended reading for moving older systems and workflows forward.
 
| Title | Source | What it is | Why it matters |
|---|---|---|---|
| [Migrate from ASP.NET Framework to ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/migration/fx-to-core/?view=aspnetcore-10.0) | Microsoft Learn | An official migration guide for incrementally moving ASP.NET Framework applications to ASP.NET Core. | It gives a practical planning path for modernization work without treating migration as an all-or-nothing rewrite. |
| [dotnet/modernize-dotnet](https://github.com/dotnet/modernize-dotnet) | GitHub | The official repository for Microsoft's Copilot-driven .NET modernization agent, including installation and setup instructions. | It is the practical starting point if you want to install the agent and understand how to use it on real modernization work. |
| [twsouthwick/fx2dotnet](https://github.com/twsouthwick/fx2dotnet) | GitHub | A GitHub Copilot agent plugin for migrating .NET Framework applications to modern .NET through ordered phases, with prerequisites and quick start guidance in the README. | It is a useful reference if you want a concrete example of a migration workflow built around small, reviewable, committable changes instead of one large automated conversion. |
| [GitHub Copilot app modernization](https://marketplace.visualstudio.com/items?itemName=vscjava.migrate-java-to-azure) | VS Code Marketplace | Extension for .NET modernization workflows in VS Code. | Enables running the modernize-dotnet agent directly within your editor for integrated modernization work. |

---

## Sample Applications

Working examples and reference implementations for common modernization patterns.

| Repository | Purpose | Recommended Branch | What to Use It For |
|---|---|---|---|
| [KSchlobohm/MvcMovieNet6](https://github.com/KSchlobohm/MvcMovieNet6) | ASP.NET Core MVC sample application | `main` | Basic MVC patterns, Entity Framework Core usage, authentication and authorization in ASP.NET Core |
| [KSchlobohm/eShopUpgrade](https://github.com/KSchlobohm/eShopUpgrade) | E-commerce platform upgrade from .NET Framework to .NET 6+ | `main` | Real-world modernization example, Azure Key Vault integration, legacy app migration patterns, incremental upgrade strategies |
| [mjrousos/UpgradeSample](https://github.com/mjrousos/UpgradeSample) | Multi-version ASP.NET MVC upgrade reference showing .NET Framework 4.7.2 to .NET 6 migration | `main` | Demonstrates upgrade patterns with three versions (original, fully upgraded, and incremental), architectural decision trade-offs, Entity Framework upgrade strategies |
| [mjrousos/windows-desktop](https://github.com/mjrousos/windows-desktop) | Windows Desktop Application Modernization Guidance with samples for WPF and WinForms | `mikerou/port-server` | Porting WPF/WinForms apps to .NET Core, Windows 10 APIs in .NET, deployment patterns, WCF client migration examples |