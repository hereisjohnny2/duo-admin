import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/* =====================================================================
   Middleware de autenticação (Supabase).
   - Atualiza (refresh) a sessão em cookies a cada request.
   - Sem sessão: redireciona páginas para /login e responde 401 nas /api.
   - Já logado em /login: manda para o painel.
   ===================================================================== */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!;

function isJwtClockSkewError(error: unknown): boolean {
  return error instanceof Error && /jwt issued at future|issued at future/i.test(error.message);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // NÃO colocar código entre createServerClient e getUser().
  let user = null;
  try {
    const {
      data: { user: u },
      error,
    } = await supabase.auth.getUser();

    if (error && isJwtClockSkewError(error)) {
      user = null;
    } else {
      user = u;
    }
  } catch (error) {
    user = null; // rede/config indisponível: trata como não autenticado
    if (isJwtClockSkewError(error)) {
      response.cookies.delete("sb-access-token");
      response.cookies.delete("sb-refresh-token");
    }
  }

  const path = request.nextUrl.pathname;
  const isAuthRoute = path === "/login" || path.startsWith("/auth");
  // Rotas do Vercel Cron não têm sessão: elas mesmas conferem o CRON_SECRET.
  const isCronRoute = path.startsWith("/api/cron/");

  if (!user && !isAuthRoute && !isCronRoute) {
    if (path.startsWith("/api")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = "";
    redirect.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(redirect);
  }

  if (user && path === "/login") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/debitos";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  // Roda em tudo, menos assets estáticos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
