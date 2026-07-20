import { Github, Instagram, Twitter, Youtube } from 'lucide-react';
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
            Personal training, reimagined. Built by AzTechFit Hong Kong.
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
            { label: 'Demo', href: '/demo' },
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
            Contact
          </h4>
          <a
            href="mailto:hello@aztechfit.com"
            className="text-sm transition-colors duration-200 hover:underline"
            style={{ color: 'var(--dark-text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--dark-text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dark-text-muted)')}
          >
            hello@aztechfit.com
          </a>
          <p className="text-sm" style={{ color: 'var(--dark-text-muted)' }}>
            Hong Kong
          </p>
        </div>

        {/* Company Column */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--dark-text-primary)' }}>
            Legal
          </h4>
          <span className="text-sm" style={{ color: 'var(--dark-text-muted)' }}>
            Privacy Policy — coming soon
          </span>
          <span className="text-sm" style={{ color: 'var(--dark-text-muted)' }}>
            Terms of Service — coming soon
          </span>
        </div>
      </div>

      {/* Social Icons Row */}
      <div className="mt-8 flex justify-center gap-5">
        {[Instagram, Twitter, Youtube, Github].map((Icon, i) => (
          <span
            key={i}
            className="cursor-not-allowed transition-colors duration-200"
            style={{ color: 'var(--dark-text-muted)' }}
          >
            <Icon size={20} />
          </span>
        ))}
      </div>
    </footer>
  );
});

export default Footer;
