import { Link } from "react-router";
import { BookOpen, PenTool, Map, Heart } from "lucide-react";
import { Button } from "~/components/ui/Button";

export function meta() {
  return [
    { title: "About Us — NomadLogs" },
    { name: "description", content: "Learn about NomadLogs — a decentralized travel community platform." },
  ];
}

const FEATURES = [
  {
    icon: <BookOpen size={28} />,
    title: "Journals",
    description: "Curate thematic collections of blog posts into beautiful, multi-part travel stories.",
  },
  {
    icon: <PenTool size={28} />,
    title: "Blogs",
    description: "Document standalone journeys with rich media, maps, and interactive location pins.",
  },
  {
    icon: <Map size={28} />,
    title: "Travel Plans",
    description: "Create structured day-by-day itineraries with maps, tips, and collaborative sharing.",
  },
];

export default function About() {
  return (
    <article className="mx-auto max-w-4xl px-6 py-16 animate-fade-in">
      {/* Hero */}
      <header className="text-center mb-16">
        <span className="text-6xl mb-6 block">🗺️</span>
        <h1 className="text-headline-display text-on-surface mb-4">About NomadLogs</h1>
        <p className="text-body-lg text-on-surface-muted max-w-2xl mx-auto">
          NomadLogs is a decentralized, community-driven travel platform where explorers
          document journeys, share stories, and plan adventures together. Built by travellers, for travellers.
        </p>
      </header>

      {/* Hero Image */}
      <figure className="relative h-96 rounded-2xl overflow-hidden border border-border-custom bg-neutral mb-12 shadow-lg">
        <img
          src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80"
          alt="NomadLogs Travel Desk"
          className="w-full h-full object-cover hover:scale-102 transition-transform duration-700"
        />
      </figure>

      {/* Mission */}
      <section className="rounded-2xl bg-surface border border-border-custom p-8 mb-12">
        <h2 className="text-headline-lg text-on-surface mb-4">Our Mission</h2>
        <p className="text-body-lg text-on-surface/90">
          We believe every journey is worth sharing. NomadLogs bridges the gap between structured
          travel planning and spontaneous storytelling — giving travellers the tools to document,
          discover, and inspire. Whether you're an armchair explorer or a seasoned adventurer,
          NomadLogs is your digital travel journal.
        </p>
      </section>

      {/* Features */}
      <section className="mb-12">
        <h2 className="text-headline-lg text-on-surface text-center mb-8">What We Offer</h2>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="h-full">
              <article className="h-full rounded-2xl bg-surface border border-border-custom p-6 text-center hover:shadow-md transition-shadow flex flex-col items-center">
                <figure className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {feature.icon}
                </figure>
                <h3 className="text-headline-md text-on-surface mb-2">{feature.title}</h3>
                <p className="text-body-md text-on-surface-muted">{feature.description}</p>
              </article>
            </li>
          ))}
        </ul>
      </section>

      {/* Support */}
      <section className="text-center rounded-2xl bg-primary/5 border border-primary/20 p-8">
        <h2 className="text-headline-md text-on-surface mb-3">Want to support our work?</h2>
        <p className="text-body-md text-on-surface-muted mb-5">
          NomadLogs is an open, community-driven project. Your support helps us keep the lights on.
        </p>
        <a href="https://ko-fi.com/nomadlogs" target="_blank" rel="noopener noreferrer">
          <Button variant="tertiary" size="lg">
            <Heart size={16} />
            Support on Ko-fi
          </Button>
        </a>
      </section>
    </article>
  );
}
