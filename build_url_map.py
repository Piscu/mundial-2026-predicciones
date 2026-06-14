import urllib.request
import sys

code_name_pairs = [
    ('MX', 'Mexico'), ('ZA', 'South_Africa'), ('KR', 'South_Korea'),
    ('CZ', 'Czech_Republic'), ('CA', 'Canada'), ('BA', 'Bosnia_and_Herzegovina'),
    ('IR', 'Iran'), ('ES', 'Spain'), ('AR', 'Argentina'), ('FR', 'France'),
    ('EN', 'England'), ('PT', 'Portugal'), ('CO', 'Colombia'), ('BR', 'Brazil'),
    ('NL', 'Netherlands'), ('EC', 'Ecuador'), ('DE', 'Germany'), ('UY', 'Uruguay'), ('IT', 'Italy'),
    ('HR', 'Croatia'), ('MA', 'Morocco'), ('HU', 'Hungary'), ('DK', 'Denmark'),
    ('JP', 'Japan'), ('CH', 'Switzerland'), ('UA', 'Ukraine'), ('SE', 'Sweden'),
    ('AT', 'Austria'), ('US', 'United_States'), ('BE', 'Belgium'), ('NO', 'Norway'),
    ('PL', 'Poland'), ('SN', 'Senegal'), ('RS', 'Serbia'), ('CM', 'Cameroon'),
    ('RO', 'Romania'), ('GR', 'Greece'), ('NG', 'Nigeria'), ('SK', 'Slovakia'),
    ('IE', 'Ireland'), ('TN', 'Tunisia'), ('PE', 'Peru'), ('GH', 'Ghana'),
    ('CI', 'Ivory_Coast'), ('CL', 'Chile'), ('DZ', 'Algeria'), ('EG', 'Egypt'),
    ('VE', 'Venezuela'), ('SI', 'Slovenia'), ('MK', 'North_Macedonia'),
    ('AL', 'Albania'), ('ME', 'Montenegro'), ('LT', 'Lithuania'), ('LV', 'Latvia'),
    ('EE', 'Estonia'), ('BY', 'Belarus'), ('IS', 'Iceland'), ('FI', 'Finland'),
    ('GE', 'Georgia'), ('AM', 'Armenia'), ('AZ', 'Azerbaijan'), ('KZ', 'Kazakhstan'),
    ('AU', 'Australia'), ('BF', 'Burkina_Faso'), ('ML', 'Mali'),
    ('PY', 'Paraguay'), ('BO', 'Bolivia'), ('CR', 'Costa_Rica'),
    ('HN', 'Honduras'), ('SV', 'El_Salvador'), ('PA', 'Panama'),
    ('JM', 'Jamaica'), ('HT', 'Haiti'), ('CU', 'Cuba'),
    ('TT', 'Trinidad_and_Tobago'), ('RU', 'Russia'),
    ('CN', 'China'), ('SA', 'Saudi_Arabia'), ('QA', 'Qatar'),
    ('AE', 'UAE'), ('IQ', 'Iraq'), ('SY', 'Syria'), ('JO', 'Jordan'),
    ('LB', 'Lebanon'), ('YE', 'Yemen'), ('OM', 'Oman'), ('KW', 'Kuwait'),
    ('AO', 'Angola'), ('ZM', 'Zambia'), ('ZW', 'Zimbabwe'),
    ('MZ', 'Mozambique'), ('MW', 'Malawi'), ('NA', 'Namibia'),
    ('BW', 'Botswana'), ('LS', 'Lesotho'), ('MG', 'Madagascar'),
    ('MU', 'Mauritius'), ('CV', 'Cape_Verde'),
    ('GN', 'Guinea'), ('SL', 'Sierra_Leone'), ('LR', 'Liberia'),
    ('BF', 'Burkina_Faso'), ('TG', 'Togo'), ('BJ', 'Benin'),
    ('NE', 'Niger'), ('GA', 'Gabon'), ('CG', 'Congo'),
    ('CD', 'DR_Congo'), ('ET', 'Ethiopia'), ('KE', 'Kenya'),
    ('TZ', 'Tanzania'), ('UG', 'Uganda'), ('RW', 'Rwanda'),
    ('SS', 'South_Sudan'),
]

code_to_url = {}
ok = 0
fail = 0
for code, name in code_name_pairs:
    url = f'https://www.eloratings.net/{name}.tsv'
    try:
        resp = urllib.request.urlopen(url, timeout=5)
        ok += 1
        code_to_url[code] = name
    except:
        fail += 1

print(f"OK: {ok}, FAIL: {fail}")
print("code_to_url = {")
for code, name in sorted(code_to_url.items()):
    print(f"    '{code}': '{name}',")
print("}")
