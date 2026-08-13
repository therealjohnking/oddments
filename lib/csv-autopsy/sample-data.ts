/**
 * A deliberately messy built-in sample so the tool is useful the moment it loads,
 * with no file to hunt for. It is generic synthetic business data (a small
 * employee directory) — nothing sensitive, nothing real.
 *
 * Every problem here is intentional, and the tests in `sample.test.ts` assert
 * that CSV Autopsy surfaces them. Reading top to bottom, the sample contains:
 *
 *   - an exact duplicate row (rows 7 and 8 are identical)               → duplicate rows
 *   - `Employee ID`, an id-shaped column, duplicated by that row        → duplicated identifier
 *   - leading / trailing whitespace in a couple of values               → whitespace
 *   - `City` values that appear both padded and clean (Austin)          → whitespace variants
 *   - three capitalizations of the same city and department             → inconsistent capitalization
 *   - "St. Louis" vs "St Louis"                                         → suspiciously similar values
 *   - `N/A`, `NULL`, and `-` used as missing markers                    → null-like tokens
 *   - one salary with a typo (a letter O for a zero)                    → numeric anomaly
 *   - one impossible start date (Feb 30)                               → date anomaly
 *   - `Middle Initial`, blank on all but one row                        → mostly-blank column
 *   - `Country`, the same value on every row                            → constant column
 *   - `Active`, a clean Yes/No column                                   → boolean inference
 */

export const SAMPLE_FILENAME = 'employees-sample.csv';

export const SAMPLE_CSV = `Employee ID,Full Name,Department,City,Salary,Start Date,Middle Initial,Country,Active
E-1001,Ada Lovelace,Engineering,Indianapolis,92000,2021-03-15,A,US,Yes
E-1002,Grace Hopper,engineering,INDIANAPOLIS,88000,2020-07-01,,US,Yes
E-1003,Alan Turing,ENGINEERING,indianapolis,120000,2019-11-30,,US,No
E-1004,Katherine Johnson,Finance,Chicago,"$85,000",2022-01-10,,US,Yes
E-1005, Linus Torvalds,Finance,Chicago,76000,2021-06-22,,US,No
E-1006,Margaret Hamilton,Operations,St. Louis,99000,2020-02-29,,US,Yes
E-1007,Dennis Ritchie,Operations,St Louis,105000,2018-05-14,,US,Yes
E-1007,Dennis Ritchie,Operations,St Louis,105000,2018-05-14,,US,Yes
E-1008,Barbara Liskov,Sales,Austin,81000,2023-03-03,,US,No
E-1009,Donald Knuth ,Sales, Austin,8O000,2022-09-19,,US,Yes
E-1010,John von Neumann,Marketing,Austin,67000,2026-02-30,,US,No
E-1011,N/A,Marketing,Chicago,0,2021-12-01,,US,Yes
E-1012,Edsger Dijkstra,Finance,Denver,91000,2020-08-08,,US,No
E-1013,Claude Shannon,Engineering,Denver,130000,2017-04-25,,US,Yes
E-1014,Tim Berners-Lee,NULL,Denver,72000,2019-10-10,,US,No
E-1015,Radia Perlman,Sales,Boston,84000,2023-07-07,-,US,Yes
`;
