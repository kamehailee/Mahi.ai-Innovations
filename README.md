# Mahi.ai Innovations — E hoʻokiaʻi ʻo Hāloa
Protecting kalo through observation, research, and community-informed technology.

## Vision

Mahi.ai Innovations is my developing venture concept connecting technology with agriculture, food security, and care for ʻāina in Hawaiʻi.

Hāloa is its first proposed project: a tool to help loʻi kalo growers document invasive apple snail activity, organize control efforts, and evaluate results.

The longer-term vision includes drone-assisted monitoring and control research, historic loʻi restoration, and understanding the wai systems that connect cultivation areas.

## Current Status

The Hāloa demo records and reviews apple snail observations for three fictional loʻi plots. PostgreSQL stores the history so it survives refreshes. The form keeps zero counts distinct from counts that were left blank. See the [Hāloa setup guide](haloa/README.md) to run the demo locally.

Use only simulated observations. A demo reader key enables viewing and an editor key enables viewing and saving. See the [Hāloa setup guide](haloa/README.md) for sign-in configuration.

## Prototype Roadmap

Planned additions include:

- View a map of sample loʻi plots and water connections.
- Attach photographs and note identification uncertainty.
- Track control activities alongside observations.
- Compare observations over time.
- Ask an AI assistant to summarize recorded evidence and identify missing information.

## Drone Research Direction

Explore a workflow for:

1. Importing aerial imagery.
2. Flagging possible egg masses for human review.
3. Mapping confirmed observations.
4. Simulating inspection and intervention plans.
5. Evaluating outcomes through follow-up surveys.

Egg detection, adult detection, and treatment effectiveness will be evaluated separately. Research in rice fields will inform questions for testing; it will not be treated as proof of effectiveness in Hawaiian loʻi.

## Planned Technical Stack

- Next.js and TypeScript for the application.
- PostgreSQL for structured records.
- Database migrations for tracked schema changes.
- Authentication and access controls.
- LLM integration for evidence-linked summaries.
- Automated tests for important application behavior.
- GitHub issues and pull requests to document development.

## First Milestone

The demo uses seeded fictional plots. Save an observation with an adult count of zero and a blank egg-mass count, then refresh to see both values in the journal.

## Data Stewardship

- Label simulated data clearly.
- Record sources, collection methods, dates, and uncertainty.
- Keep sensitive site locations and restricted knowledge out of public sample data.
- Seek permission before using growers’ records or photographs.
- Keep decisions about land, wai, and control practices with the people responsible for them.

## Research References

- [UAV-Based Techniques for Monitoring and Prevention of Invasive Apple Snails in Rice Paddy Fields](https://www.mdpi.com/2077-0472/14/2/299)
- [Development of UAV to Monitor and Eradicate Golden Apple Snails in Agricultural Plots](https://ph04.tci-thaijo.org/index.php/SEC/article/view/10467)

## Learning and Development

I am building this portfolio project to develop practical software and AI skills while exploring a problem that matters to Hawaiʻi.

Development notes will document what I built, what I learned, how I tested it, and where AI tools assisted me.
