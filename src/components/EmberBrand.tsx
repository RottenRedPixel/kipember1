import Image from 'next/image';
import Link from 'next/link';

type EmberBrandProps = {
  href?: string;
  subtitle?: string;
  compact?: boolean;
};

export default function EmberBrand({
  href = '/',
  subtitle = 'living memory system',
  compact = false,
}: EmberBrandProps) {
  const content = (
    <>
      <span className={`ember-brand-mark ${compact ? 'ember-brand-mark-compact' : ''}`}>
        <Image src="/emberfav.svg" alt="" width={28} height={28} priority />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="ember-brand-title">Ember</span>
        <span className="ember-brand-subtitle">{subtitle}</span>
      </span>
    </>
  );

  return (
    <Link
      href={href}
      className={`ember-brand ${compact ? 'gap-3' : 'gap-3.5'}`}
    >
      {content}
    </Link>
  );
}
