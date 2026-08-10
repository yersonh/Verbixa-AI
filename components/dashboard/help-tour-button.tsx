"use client";

import { usePathname } from "next/navigation";
import { driver, type DriveStep } from "driver.js";
import { HelpCircle } from "lucide-react";
import "driver.js/dist/driver.css";

import { Button } from "@/components/ui/button";

const NAV_STEPS: DriveStep[] = [
  {
    element: '[data-tour="brand"]',
    popover: {
      title: "Bienvenido a Verbixa AI",
      description:
        "Te mostramos rápido cómo usar la plataforma. Puedes salir del recorrido en cualquier momento con Esc.",
    },
  },
  {
    element: '[data-tour="nav-dashboard"]',
    popover: {
      title: "Dashboard",
      description:
        "Resumen general: cuántas reuniones tienes, actas completadas, tareas pendientes y tus reuniones más recientes.",
    },
  },
  {
    element: '[data-tour="nav-meetings"]',
    popover: {
      title: "Reuniones",
      description:
        "Aquí agendas reuniones para que el bot se una automáticamente, o subes una grabación ya hecha para documentarla.",
    },
  },
  {
    element: '[data-tour="nav-transcripts"]',
    popover: {
      title: "Transcripciones",
      description:
        "El texto completo de cada reunión, generado automáticamente a partir del audio.",
    },
  },
  {
    element: '[data-tour="nav-tasks"]',
    popover: {
      title: "Tareas",
      description:
        "Las tareas que la IA detectó en tus reuniones (quién debe hacer qué, y para cuándo), agrupadas por reunión.",
    },
  },
  {
    element: '[data-tour="nav-settings"]',
    popover: {
      title: "Configuración",
      description: "Ajustes de tu organización e invitación de miembros.",
    },
  },
  {
    element: '[data-tour="notifications"]',
    popover: {
      title: "Notificaciones",
      description:
        "Te avisamos aquí cuando una transcripción o un acta queda lista, o si algo falla.",
    },
  },
];

const DASHBOARD_HOME_STEPS: DriveStep[] = [
  {
    element: '[data-tour="dashboard-stats"]',
    popover: {
      title: "Tus números",
      description:
        "Vista rápida de cuántas reuniones has documentado y cuántas tareas siguen pendientes.",
    },
  },
  {
    element: '[data-tour="dashboard-recent"]',
    popover: {
      title: "Reuniones recientes",
      description: "Accede rápido a las últimas reuniones documentadas.",
    },
  },
];

const MEETINGS_LIST_STEPS: DriveStep[] = [
  {
    element: '[data-tour="meetings-actions"]',
    popover: {
      title: "Agrega una reunión",
      description:
        '"Agendar con bot" hace que Verbixa se una solo a tu próxima llamada (Google Meet o Teams). "Subir grabación" documenta una reunión que ya hiciste.',
    },
  },
  {
    element: '[data-tour="meetings-filters"]',
    popover: {
      title: "Busca y filtra",
      description: "Filtra tu historial de reuniones por título o por fecha.",
    },
  },
  {
    element: '[data-tour="meetings-list"]',
    popover: {
      title: "Tu historial",
      description:
        "Cada reunión muestra su estado. Haz clic en cualquiera para ver su transcripción y acta.",
    },
  },
];

const MEETING_DETAIL_STEPS: DriveStep[] = [
  {
    element: '[data-tour="meeting-info"]',
    popover: {
      title: "Información de la reunión",
      description: "Estado, fecha, plataforma y el enlace original de la llamada.",
    },
  },
  {
    element: '[data-tour="meeting-transcript"]',
    popover: {
      title: "Transcripción",
      description:
        "El texto completo con cada intervención, ya con el nombre real de quien habló cuando está disponible.",
    },
  },
  {
    element: '[data-tour="meeting-summary"]',
    popover: {
      title: "Acta",
      description:
        "Resumen ejecutivo, decisiones clave y tareas generadas automáticamente por IA.",
    },
  },
  {
    element: '[data-tour="meeting-chat"]',
    popover: {
      title: "Asistente IA",
      description:
        "Abre un chat para preguntar lo que quieras sobre esta reunión específica: decisiones, temas puntuales, quién dijo qué, etc.",
    },
    skipMissingElement: true,
  },
];

function getPageSteps(pathname: string): DriveStep[] {
  if (pathname === "/dashboard") return DASHBOARD_HOME_STEPS;
  if (pathname === "/dashboard/meetings") return MEETINGS_LIST_STEPS;
  if (/^\/dashboard\/meetings\/[^/]+$/.test(pathname)) {
    return MEETING_DETAIL_STEPS;
  }
  return [];
}

export function HelpTourButton() {
  const pathname = usePathname();

  function startTour() {
    const steps = [...NAV_STEPS, ...getPageSteps(pathname)].map((step) => ({
      ...step,
      skipMissingElement: step.skipMissingElement ?? true,
    }));

    driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.65,
      nextBtnText: "Siguiente",
      prevBtnText: "Anterior",
      doneBtnText: "Listo",
      progressText: "{{current}} de {{total}}",
      steps,
    }).drive();
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={startTour}
      title="Cómo usar Verbixa AI"
    >
      <HelpCircle />
      <span className="sr-only">Cómo usar</span>
    </Button>
  );
}
