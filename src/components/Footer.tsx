import { Github } from 'lucide-react';
import { memo } from 'react';

const Footer = memo(function Footer() {
  return (
    <footer
      className="w-full border-t pt-8 pb-8"
      style={{
        borderColor: 'var(--dark-border)',
      }}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand Column */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <img src="./azfit-logo.png" alt="AzFIT" className="h-8 object-contain" />
            <span className="text-lg font-bold text-shadow-light" style={{ color: 'var(--dark-text-primary)' }}>
              AzFIT
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--dark-text-muted)' }}>
            Personal training, reimagined.
          </p>
          <p className="mt-2 text-xs" style={{ color: 'var(--dark-text-muted)' }}>
            &copy; 2026 AzFIT
          </p>
        </div>

        {/* Product Column */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--dark-text-primary)' }}>
            Product
          </h4>
          {[
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm transition-colors duration-200 hover:underline"
              style={{ color: 'var(--dark-text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--dark-text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dark-text-muted)')}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Resources Column */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--dark-text-primary)' }}>
            Resources
          </h4>
          <a
            href="#/exercises"
            className="text-sm transition-colors duration-200 hover:underline"
            style={{ color: 'var(--dark-text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--dark-text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dark-text-muted)')}
          >
            Exercise Library
          </a>
        </div>

        {/* Company Column — removed until pages exist */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--dark-text-primary)' }}>
            Company
          </h4>
          <span className="text-sm" style={{ color: 'var(--dark-text-muted)' }}>
            Coming soon
          </span>
        </div>
      </div>

      {/* Social Icons Row */}
      <div className="mt-8 flex justify-center gap-5">
        <a
          href="https://github.com/AzFIT/Azfit.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-200"
          style={{ color: 'var(--dark-text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--dark-text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dark-text-muted)')}
        >
          <Github size={20} />
        </a>
      </div>
    </footer>
  );
});

export default Footer;
