-- Keep campaign-facing copy aligned with DESIGN.md punctuation rules.
-- Existing remote demo rows may predate the current seed files, so this
-- normalizes em dashes wherever campaign copy can reach brands or creators.

update public.campaigns
set
  title = replace(title, chr(8212), '-'),
  brief_description = case
    when brief_description is null then null
    else replace(brief_description, chr(8212), '-')
  end,
  brief_requirements = case
    when brief_requirements is null then null
    else replace(brief_requirements, chr(8212), '-')
  end,
  brief_dos = case
    when brief_dos is null then null
    else replace(brief_dos, chr(8212), '-')
  end,
  brief_donts = case
    when brief_donts is null then null
    else replace(brief_donts, chr(8212), '-')
  end,
  compliance_notes = case
    when compliance_notes is null then null
    else replace(compliance_notes, chr(8212), '-')
  end,
  brief_translated = case
    when brief_translated is null then null
    else replace(brief_translated::text, chr(8212), '-')::jsonb
  end
where
  title like '%' || chr(8212) || '%'
  or brief_description like '%' || chr(8212) || '%'
  or brief_requirements like '%' || chr(8212) || '%'
  or brief_dos like '%' || chr(8212) || '%'
  or brief_donts like '%' || chr(8212) || '%'
  or compliance_notes like '%' || chr(8212) || '%'
  or brief_translated::text like '%' || chr(8212) || '%';

update public.campaign_brief_blocks
set
  title = replace(title, chr(8212), '-'),
  body = case
    when body is null then null
    else replace(body, chr(8212), '-')
  end,
  items = replace(items::text, chr(8212), '-')::jsonb
where
  title like '%' || chr(8212) || '%'
  or body like '%' || chr(8212) || '%'
  or items::text like '%' || chr(8212) || '%';

update public.campaign_assets
set
  title = replace(title, chr(8212), '-'),
  description = case
    when description is null then null
    else replace(description, chr(8212), '-')
  end
where
  title like '%' || chr(8212) || '%'
  or description like '%' || chr(8212) || '%';
